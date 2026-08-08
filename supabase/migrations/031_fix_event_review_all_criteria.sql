-- 031: Fix the `event_review_all` badge criteria ("The Hansard" / "Thorough Taster")
--
-- The old criteria was "the user has at least one check-in for this event, and
-- none of their check-ins have a NULL review_id". That is satisfied trivially
-- after the FIRST stop when the review is submitted via "Check in + review",
-- because that path inserts the check-in with review_id already populated —
-- one check-in, zero nulls, badge awarded. (Confirmed on the 2026 DC crawl:
-- 9 earners of "Thorough Taster", including a user who reviewed 6 of 7 stops.)
--
-- Conversely, a user who taps "Check in" first and reviews later gets the
-- review linked by an UPDATE, and award_after_checkin is AFTER INSERT only —
-- so that path may never award at all.
--
-- New criteria mirrors `event_complete` but over reviews: the event has stops,
-- and there is no stop lacking a review by this user. This is independent of
-- check-in ordering, and reviews carry event_stop_id directly, so the
-- award_after_review trigger evaluates it correctly on the final review.
--
-- Only the `event_review_all` branch changes; the rest of the function is
-- reproduced verbatim (plpgsql has no way to patch a single branch).

CREATE OR REPLACE FUNCTION public.award_user_badges(p_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b      record;
  earned boolean;
  cfg    jsonb;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  FOR b IN SELECT * FROM public.badges WHERE is_active = true LOOP

    -- Generic-criteria badges tied to an event (e.g. the Canadiana set) are
    -- evaluated event-scoped by award_canadiana_badges; the queries below are
    -- not event-aware, so skip them here.
    IF b.event_id IS NOT NULL AND b.criteria_type NOT LIKE 'event\_%' THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = b.id
    ) THEN CONTINUE; END IF;

    cfg    := b.criteria_config;
    earned := false;

    IF b.criteria_type = 'first_review' THEN
      earned := EXISTS (SELECT 1 FROM public.reviews WHERE user_id = p_user_id);

    ELSIF b.criteria_type = 'review_count' THEN
      earned := (SELECT COUNT(*)::int FROM public.reviews WHERE user_id = p_user_id)
                >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'wing_size_variety' THEN
      earned := (
        SELECT COUNT(DISTINCT wing_size) FROM public.reviews
        WHERE user_id = p_user_id AND wing_size IS NOT NULL
      ) >= 4;

    ELSIF b.criteria_type = 'event_rsvp' THEN
      earned := EXISTS (
        SELECT 1 FROM public.event_rsvps
        WHERE user_id = p_user_id AND event_id = b.event_id AND status = 'going'
      );

    ELSIF b.criteria_type = 'event_rsvp_with_guests' THEN
      earned := EXISTS (
        SELECT 1 FROM public.event_rsvps
        WHERE user_id = p_user_id AND event_id = b.event_id
          AND status = 'going' AND guest_count > 0
      );

    ELSIF b.criteria_type = 'event_checkin_count' THEN
      earned := (
        SELECT COUNT(*)::int FROM public.event_checkins
        WHERE user_id = p_user_id AND event_id = b.event_id
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'event_first_checkin' THEN
      earned := EXISTS (
        SELECT 1 FROM public.event_checkins ec
        WHERE ec.event_id = b.event_id AND ec.user_id = p_user_id
          AND ec.checked_in_at = (
            SELECT MIN(checked_in_at) FROM public.event_checkins
            WHERE event_id = b.event_id
          )
      );

    ELSIF b.criteria_type = 'event_complete' THEN
      earned := (
        b.event_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.event_stops WHERE event_id = b.event_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.event_stops es
          WHERE es.event_id = b.event_id
            AND NOT EXISTS (
              SELECT 1 FROM public.event_checkins ec
              WHERE ec.event_stop_id = es.id AND ec.user_id = p_user_id
            )
        )
      );

    -- CHANGED in 031: every stop must have a review by this user.
    ELSIF b.criteria_type = 'event_review_all' THEN
      earned := (
        b.event_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.event_stops WHERE event_id = b.event_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.event_stops es
          WHERE es.event_id = b.event_id
            AND NOT EXISTS (
              SELECT 1 FROM public.reviews r
              WHERE r.event_id      = b.event_id
                AND r.event_stop_id = es.id
                AND r.user_id       = p_user_id
            )
        )
      );

    ELSIF b.criteria_type = 'event_review_count' THEN
      earned := (
        SELECT COUNT(*)::int FROM public.reviews
        WHERE user_id = p_user_id AND event_id = b.event_id
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'unique_spots' THEN
      earned := (
        SELECT COUNT(DISTINCT wing_spot_id)::int FROM public.reviews WHERE user_id = p_user_id
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'flavor_variety' THEN
      earned := (
        SELECT COUNT(DISTINCT LOWER(TRIM(wing_flavor)))::int
        FROM public.reviews
        WHERE user_id = p_user_id AND wing_flavor IS NOT NULL AND TRIM(wing_flavor) <> ''
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'lemon_pepper' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id AND LOWER(wing_flavor) LIKE '%lemon pepper%'
      );

    ELSIF b.criteria_type = 'ranch_fan' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id AND LOWER(wing_flavor) LIKE '%ranch%'
      );

    ELSIF b.criteria_type = 'heat_seeker' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id
          AND LOWER(wing_flavor) ~* 'ghost|reaper|habanero|scorpion|carolina|blazin|inferno|diablo'
      );

    ELSIF b.criteria_type = 'comment_count' THEN
      earned := (
        SELECT COUNT(*)::int FROM public.review_comments WHERE user_id = p_user_id
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'avg_rating_high' THEN
      earned := (SELECT COUNT(*)::int FROM public.reviews WHERE user_id = p_user_id)
                  >= COALESCE((cfg->>'min_reviews')::int, 5)
                AND (SELECT AVG(overall_rating) FROM public.reviews WHERE user_id = p_user_id)
                  >= COALESCE((cfg->>'min_avg')::numeric, 9);

    ELSIF b.criteria_type = 'avg_rating_low' THEN
      earned := (SELECT COUNT(*)::int FROM public.reviews WHERE user_id = p_user_id)
                  >= COALESCE((cfg->>'min_reviews')::int, 5)
                AND (SELECT AVG(overall_rating) FROM public.reviews WHERE user_id = p_user_id)
                  <= COALESCE((cfg->>'max_avg')::numeric, 4);

    ELSIF b.criteria_type = 'perfect_ten' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews WHERE user_id = p_user_id AND overall_rating = 10
      );

    ELSIF b.criteria_type = 'takeout_count' THEN
      earned := (
        SELECT COUNT(*)::int FROM public.reviews
        WHERE user_id = p_user_id AND is_takeout = true
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'loyal_regular' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id
        GROUP BY wing_spot_id
        HAVING COUNT(*) >= COALESCE((cfg->>'count')::int, 3)
      );

    ELSIF b.criteria_type = 'jumbo_fan' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews WHERE user_id = p_user_id AND wing_size = 'jumbo'
      );

    ELSIF b.criteria_type = 'review_text_contains' THEN
      IF cfg ? 'pattern' THEN
        earned := EXISTS (
          SELECT 1 FROM public.reviews
          WHERE user_id = p_user_id AND review_text ~* (cfg->>'pattern')
        );
      ELSE
        earned := EXISTS (
          SELECT 1 FROM public.reviews
          WHERE user_id = p_user_id
            AND LOWER(review_text) LIKE '%' || LOWER(cfg->>'word') || '%'
        );
      END IF;

    ELSIF b.criteria_type = 'review_text_long' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id
          AND review_text IS NOT NULL
          AND LENGTH(review_text) >= COALESCE((cfg->>'min_length')::int, 300)
      );

    ELSIF b.criteria_type = 'review_text_short' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id
          AND review_text IS NOT NULL
          AND TRIM(review_text) <> ''
          AND LENGTH(TRIM(review_text)) <= COALESCE((cfg->>'max_length')::int, 15)
      );

    ELSIF b.criteria_type = 'single_rating_low' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id
          AND overall_rating <= COALESCE((cfg->>'max_rating')::numeric, 2)
      );

    ELSIF b.criteria_type = 'rating_floor' THEN
      earned := (
        (SELECT COUNT(*)::int FROM public.reviews WHERE user_id = p_user_id)
          >= COALESCE((cfg->>'min_reviews')::int, 5)
        AND NOT EXISTS (
          SELECT 1 FROM public.reviews
          WHERE user_id = p_user_id
            AND overall_rating < COALESCE((cfg->>'min_rating')::numeric, 8)
        )
      );

    ELSIF b.criteria_type = 'rating_no_decimals' THEN
      earned := (
        (SELECT COUNT(*)::int FROM public.reviews WHERE user_id = p_user_id)
          >= COALESCE((cfg->>'min_reviews')::int, 3)
        AND NOT EXISTS (
          SELECT 1 FROM public.reviews
          WHERE user_id = p_user_id
            AND overall_rating <> FLOOR(overall_rating)
        )
      );

    ELSIF b.criteria_type = 'rating_uses_decimals' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id
          AND overall_rating <> FLOOR(overall_rating)
      );

    -- ── Crawl criteria ─────────────────────────────────────────────────────

    ELSIF b.criteria_type = 'first_crawl' THEN
      earned := EXISTS (SELECT 1 FROM public.wing_crawls WHERE user_id = p_user_id);

    ELSIF b.criteria_type = 'crawl_count' THEN
      earned := (SELECT COUNT(*)::int FROM public.wing_crawls WHERE user_id = p_user_id)
                >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'crawl_with_n_spots' THEN
      earned := EXISTS (
        SELECT 1
        FROM public.wing_crawls c
        JOIN public.wing_crawl_items ci ON ci.crawl_id = c.id
        WHERE c.user_id = p_user_id
        GROUP BY c.id
        HAVING COUNT(ci.id) >= COALESCE((cfg->>'min_items')::int, 5)
      );

    ELSIF b.criteria_type = 'crawl_with_n_likes' THEN
      earned := EXISTS (
        SELECT 1
        FROM public.wing_crawls c
        JOIN public.crawl_likes cl ON cl.crawl_id = c.id
        WHERE c.user_id = p_user_id
        GROUP BY c.id
        HAVING COUNT(cl.id) >= COALESCE((cfg->>'min_likes')::int, 10)
      );

    END IF;

    IF earned THEN
      INSERT INTO public.user_badges (user_id, badge_id, event_id)
      VALUES (p_user_id, b.id, b.event_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING
      RETURNING badge_id INTO b.id;
      RETURN NEXT b.id;
    END IF;

  END LOOP;
END;
$function$;
