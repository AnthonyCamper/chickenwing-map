-- ============================================================================
-- 027 — Canadiana badges are crawl-only
-- ============================================================================
-- The 026 Canadiana badges were global (earnable from all-time activity).
-- They should ONLY be earnable at the 2026 Chicken Wing Crawl Ottawa:
--   - drops the 4 count-based badges that cannot fit inside a one-day crawl
--     (The Alfie / The Two-Four / The Snowbirds / Snow Day)
--   - scopes the remaining 13 to the Ottawa event (event_id set) and rewrites
--     their how-to-earn hints to say so
--   - award_user_badges now SKIPS generic-criteria badges that carry an
--     event_id (its queries are not event-aware); award_canadiana_badges
--     takes those over and matches only reviews with the badge's event_id
--   - revokes the 026 backfill awards — they came from pre-crawl activity
-- ============================================================================

-- ── 1. Revoke 026 awards and drop the impossible-in-a-day badges ─────────────
DELETE FROM public.user_badges
WHERE badge_id IN (SELECT id FROM public.badges WHERE slug LIKE 'canadiana-%');

DELETE FROM public.badges
WHERE slug IN ('canadiana-alfie', 'canadiana-two-four', 'canadiana-snowbirds', 'canadiana-snow-day');

-- ── 2. Scope the rest to the Ottawa crawl + crawl-aware hints ────────────────
UPDATE public.badges SET event_id = '0663c3e0-1f6c-424b-8ad6-044652a0a194'
WHERE slug LIKE 'canadiana-%';

UPDATE public.badges SET criteria_config = '{"value": 6.7, "hint": "Rate exactly 6.7 on a crawl review."}'::jsonb WHERE slug = 'canadiana-confederation';
UPDATE public.badges SET criteria_config = '{"value": 7.1, "hint": "Rate exactly 7.1 on a crawl review."}'::jsonb WHERE slug = 'canadiana-canada-day';
UPDATE public.badges SET criteria_config = '{"value": 7.8, "hint": "Rate exactly 7.8 on a crawl review."}'::jsonb WHERE slug = 'canadiana-skateway';
UPDATE public.badges SET criteria_config = '{"value": 9.9, "hint": "Rate exactly 9.9 on a crawl review."}'::jsonb WHERE slug = 'canadiana-great-one';
UPDATE public.badges SET criteria_config = '{"value": 1.0, "hint": "Rate exactly 1.0 on a crawl review."}'::jsonb WHERE slug = 'canadiana-loonie';
UPDATE public.badges SET criteria_config = '{"value": 2.0, "hint": "Rate exactly 2.0 on a crawl review."}'::jsonb WHERE slug = 'canadiana-toonie';
UPDATE public.badges SET criteria_config = '{"pattern": "\\ypoutines?\\y", "hint": "Mention poutine in a review during the crawl."}'::jsonb WHERE slug = 'canadiana-poutine';
UPDATE public.badges SET criteria_config = '{"pattern": "\\y(flavour|favourite|colour|honour|neighbour|savoury)", "hint": "Use a Canadian spelling — flavour, favourite, colour — in a crawl review."}'::jsonb WHERE slug = 'canadiana-extra-u';
UPDATE public.badges SET criteria_config = '{"pattern": "\\ysorry\\y", "hint": "Type the word ''sorry'' in a crawl review."}'::jsonb WHERE slug = 'canadiana-sorry';
UPDATE public.badges SET criteria_config = '{"pattern": "\\ymaple\\y", "hint": "Mention maple in a crawl review."}'::jsonb WHERE slug = 'canadiana-tapped';
UPDATE public.badges SET criteria_config = '{"pattern": "\\y(hockey|senators|sens)\\y", "hint": "Mention hockey (or the Sens) in a crawl review."}'::jsonb WHERE slug = 'canadiana-rink-rat';
UPDATE public.badges SET criteria_config = '{"pattern": "\\y(tim hortons|timmies|timbits?)\\y", "hint": "Mention Tim Hortons, Timmies, or Timbits in a crawl review."}'::jsonb WHERE slug = 'canadiana-timmies';
UPDATE public.badges SET criteria_config = '{"text": "honey garlic", "hint": "Review honey garlic wings at a crawl stop."}'::jsonb WHERE slug = 'canadiana-honey-garlic';

-- ── 3. award_user_badges: skip event-scoped generic-criteria badges ──────────
-- (Faithful copy of the live function + the one guard at the top of the loop.)
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

    ELSIF b.criteria_type = 'event_review_count' THEN
      earned := (
        SELECT COUNT(*)::int FROM public.reviews
        WHERE user_id = p_user_id AND event_id = b.event_id
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'event_review_all' THEN
      earned := (
        b.event_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.event_checkins WHERE event_id = b.event_id AND user_id = p_user_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.event_checkins ec
          WHERE ec.event_id = b.event_id AND ec.user_id = p_user_id
            AND ec.review_id IS NULL
        )
      );

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

-- ── 4. award_canadiana_badges: event-scoped matching, takes over
--       review_text_contains badges that carry an event_id ───────────────────
CREATE OR REPLACE FUNCTION public.award_canadiana_badges(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b      record;
  earned boolean;
  cfg    jsonb;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  FOR b IN
    SELECT * FROM public.badges
    WHERE is_active = true
      AND (
        criteria_type IN ('rating_exact', 'flavor_contains')
        OR (criteria_type = 'review_text_contains' AND event_id IS NOT NULL)
      )
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = b.id
    ) THEN CONTINUE; END IF;

    cfg    := b.criteria_config;
    earned := false;

    IF b.criteria_type = 'rating_exact' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews r
        WHERE r.user_id = p_user_id
          AND r.overall_rating = (cfg->>'value')::numeric
          AND (b.event_id IS NULL OR r.event_id = b.event_id)
      );

    ELSIF b.criteria_type = 'flavor_contains' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews r
        WHERE r.user_id = p_user_id
          AND LOWER(r.wing_flavor) LIKE '%' || LOWER(cfg->>'text') || '%'
          AND (b.event_id IS NULL OR r.event_id = b.event_id)
      );

    ELSIF b.criteria_type = 'review_text_contains' THEN
      IF cfg ? 'pattern' THEN
        earned := EXISTS (
          SELECT 1 FROM public.reviews r
          WHERE r.user_id = p_user_id
            AND r.review_text ~* (cfg->>'pattern')
            AND (b.event_id IS NULL OR r.event_id = b.event_id)
        );
      ELSE
        earned := EXISTS (
          SELECT 1 FROM public.reviews r
          WHERE r.user_id = p_user_id
            AND LOWER(r.review_text) LIKE '%' || LOWER(cfg->>'word') || '%'
            AND (b.event_id IS NULL OR r.event_id = b.event_id)
        );
      END IF;

    END IF;

    IF earned THEN
      INSERT INTO public.user_badges (user_id, badge_id, event_id)
      VALUES (p_user_id, b.id, b.event_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;

-- No backfill: crawl reviews don't exist yet, so nobody can currently qualify.
