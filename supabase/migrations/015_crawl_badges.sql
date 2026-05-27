-- Phase 2 engagement: badges for crawl activity.
-- New criteria_type values, new badge rows, extended award_user_badges,
-- and triggers that award them on relevant crawl writes.

-- ── 1. Expand criteria_type constraint ───────────────────────────────────
ALTER TABLE public.badges DROP CONSTRAINT badges_criteria_type_check;
ALTER TABLE public.badges ADD CONSTRAINT badges_criteria_type_check CHECK (criteria_type = ANY (ARRAY[
  'first_review', 'review_count', 'wing_size_variety',
  'event_rsvp', 'event_rsvp_with_guests',
  'event_checkin_count', 'event_complete', 'event_first_checkin',
  'event_review_count', 'event_review_all',
  'unique_spots', 'flavor_variety',
  'lemon_pepper', 'ranch_fan', 'heat_seeker',
  'comment_count', 'avg_rating_high', 'avg_rating_low',
  'perfect_ten', 'takeout_count', 'loyal_regular', 'jumbo_fan',
  'review_text_contains', 'review_text_long', 'review_text_short',
  'single_rating_low', 'rating_floor', 'rating_no_decimals', 'rating_uses_decimals',
  -- Crawl badges
  'first_crawl', 'crawl_with_n_spots', 'crawl_with_n_likes', 'crawl_count'
]));

-- ── 2. Seed crawl badges ─────────────────────────────────────────────────
INSERT INTO public.badges (slug, name, description, icon, color, criteria_type, criteria_config, event_id, sort_order, is_active) VALUES
  ('first-crawl',
   'First Crawl',
   'Built your first crawl. The list life begins.',
   '📋', 'sauce', 'first_crawl', '{}'::jsonb, NULL, 70, true),
  ('crawl-curator',
   'Curator',
   'Built a crawl with 5 or more spots. A real list, not a vibe.',
   '🗂️', 'sauce', 'crawl_with_n_spots', '{"min_items": 5}'::jsonb, NULL, 72, true),
  ('crawl-crowd-pleaser',
   'Crowd Pleaser',
   'A crawl of yours hit 10 likes. People are listening.',
   '🔥', 'gold', 'crawl_with_n_likes', '{"min_likes": 10}'::jsonb, NULL, 74, true),
  ('crawl-prolific',
   'Prolific Curator',
   'Published 5 crawls. You have opinions and a directory.',
   '📚', 'sauce', 'crawl_count', '{"count": 5}'::jsonb, NULL, 76, true)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. Extend award_user_badges with crawl criteria ──────────────────────
CREATE OR REPLACE FUNCTION public.award_user_badges(p_user_id uuid)
RETURNS SETOF uuid
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

  FOR b IN SELECT * FROM public.badges WHERE is_active = true LOOP

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
$$;

-- ── 4. Triggers — award badges after relevant crawl activity ─────────────

CREATE OR REPLACE FUNCTION public.award_after_crawl_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF TG_TABLE_NAME = 'wing_crawls' THEN
    v_owner := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'wing_crawl_items' THEN
    SELECT user_id INTO v_owner FROM public.wing_crawls WHERE id = NEW.crawl_id;
  ELSIF TG_TABLE_NAME = 'crawl_likes' THEN
    SELECT user_id INTO v_owner FROM public.wing_crawls WHERE id = NEW.crawl_id;
  END IF;

  IF v_owner IS NOT NULL THEN
    PERFORM public.award_user_badges(v_owner);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_after_crawl ON public.wing_crawls;
CREATE TRIGGER trg_award_after_crawl
  AFTER INSERT ON public.wing_crawls
  FOR EACH ROW EXECUTE FUNCTION public.award_after_crawl_change();

DROP TRIGGER IF EXISTS trg_award_after_crawl_item ON public.wing_crawl_items;
CREATE TRIGGER trg_award_after_crawl_item
  AFTER INSERT ON public.wing_crawl_items
  FOR EACH ROW EXECUTE FUNCTION public.award_after_crawl_change();

DROP TRIGGER IF EXISTS trg_award_after_crawl_like ON public.crawl_likes;
CREATE TRIGGER trg_award_after_crawl_like
  AFTER INSERT ON public.crawl_likes
  FOR EACH ROW EXECUTE FUNCTION public.award_after_crawl_change();

-- ── 5. Backfill — award new crawl badges to anyone who already qualifies ─
DO $$
DECLARE uid uuid;
BEGIN
  FOR uid IN
    SELECT DISTINCT user_id FROM public.wing_crawls
  LOOP
    PERFORM public.award_user_badges(uid);
  END LOOP;
END;
$$;
