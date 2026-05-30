-- ============================================================================
-- 019 — Funny crawl badges
-- ============================================================================
-- A pile of dumb, fun badges awarded for crawl behaviour. ADDITIVE and
-- REVERSIBLE:
--   - expands the criteria_type CHECK with 8 new types (keeps every old one)
--   - seeds 11 new badge rows (two reuse existing criteria types, so the
--     existing award_user_badges already handles them)
--   - adds a SEPARATE evaluator, award_crawl_funny_badges(), for the 8 new
--     criteria types. award_user_badges is NOT modified — it simply skips
--     criteria types it doesn't recognise, so nothing it does changes.
--   - the crawl trigger now calls BOTH evaluators
--   - backfills existing crawl owners
--
-- Rollback: supabase/rollback/019_funny_crawl_badges_rollback.sql
-- ============================================================================

-- ── 1. Expand criteria_type constraint (old values + 8 new) ──────────────────
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
  'first_crawl', 'crawl_with_n_spots', 'crawl_with_n_likes', 'crawl_count',
  -- New funny crawl criteria
  'crawl_items_exact', 'crawl_self_like', 'crawl_desc_long', 'crawl_title_short',
  'crawl_ranked', 'crawl_zero_likes_count', 'crawl_duplicate_title', 'crawl_same_day'
]));

-- ── 2. Seed the funny badges ─────────────────────────────────────────────────
INSERT INTO public.badges (slug, name, description, icon, color, criteria_type, criteria_config, event_id, sort_order, is_active) VALUES
  ('crawl-one-and-done',
   'One and Done',
   'Made a crawl with exactly one spot. Bold. Minimalist. Possibly a cry for help.',
   '🥲', 'sauce', 'crawl_items_exact', '{"count": 1}'::jsonb, NULL, 78, true),

  ('crawl-empty-promises',
   'Empty Promises',
   'Created a crawl and added literally nothing to it. A beautiful empty container of hope.',
   '🫙', 'night', 'crawl_items_exact', '{"count": 0}'::jsonb, NULL, 79, true),

  ('crawl-hoarder',
   'Wing Hoarder',
   '15+ spots in a single crawl. Seek help. Or seek wings. Honestly, both.',
   '🛒', 'sauce', 'crawl_with_n_spots', '{"min_items": 15}'::jsonb, NULL, 80, true),

  ('crawl-self-care',
   'Self Care',
   'Liked your own crawl. Somebody had to. Might as well be you, king.',
   '🫶', 'neon', 'crawl_self_like', '{}'::jsonb, NULL, 81, true),

  ('crawl-yapper',
   'Certified Yapper',
   'Wrote a crawl description over 200 characters. Nobody read it. Touch grass.',
   '📜', 'gold', 'crawl_desc_long', '{"min_length": 200}'::jsonb, NULL, 82, true),

  ('crawl-idk-lol',
   'idk lol',
   'Named a crawl 3 characters or fewer. ''idk'' is not a name. It is a vibe.',
   '🤷', 'night', 'crawl_title_short', '{"max_length": 3}'::jsonb, NULL, 83, true),

  ('crawl-tier-lord',
   'Tier Lord',
   'Made a ranked crawl. There is a #1 and you WILL die on that hill.',
   '📊', 'gold', 'crawl_ranked', '{}'::jsonb, NULL, 84, true),

  ('crawl-nobody-asked',
   'Nobody Asked',
   'Three crawls, zero likes between them. The void is listening, even if no one else is.',
   '🦗', 'night', 'crawl_zero_likes_count', '{"count": 3}'::jsonb, NULL, 85, true),

  ('crawl-ctrl-c-ctrl-v',
   'Ctrl+C Ctrl+V',
   'Two crawls with the exact same name. Originality is a construct anyway.',
   '📋', 'sauce', 'crawl_duplicate_title', '{}'::jsonb, NULL, 86, true),

  ('crawl-manic-episode',
   'Manic Episode',
   'Made two crawls on the same day. Diagnosis: list goblin. Treatment: more lists.',
   '⏱️', 'neon', 'crawl_same_day', '{}'::jsonb, NULL, 87, true),

  ('crawl-main-character',
   'Main Character',
   'A crawl of yours hit 25 likes. The wing council acknowledges your dominance.',
   '👑', 'gold', 'crawl_with_n_likes', '{"min_likes": 25}'::jsonb, NULL, 88, true)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. Evaluator for the new funny criteria types ────────────────────────────
-- Kept separate from award_user_badges so that big function is untouched.
-- award_user_badges skips unknown criteria types, so it ignores these.
CREATE OR REPLACE FUNCTION public.award_crawl_funny_badges(p_user_id uuid)
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
      AND criteria_type IN (
        'crawl_items_exact', 'crawl_self_like', 'crawl_desc_long', 'crawl_title_short',
        'crawl_ranked', 'crawl_zero_likes_count', 'crawl_duplicate_title', 'crawl_same_day'
      )
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = b.id
    ) THEN CONTINUE; END IF;

    cfg    := b.criteria_config;
    earned := false;

    IF b.criteria_type = 'crawl_items_exact' THEN
      -- exactly N items in some crawl (LEFT JOIN so 0-item crawls count)
      earned := EXISTS (
        SELECT 1
        FROM public.wing_crawls c
        LEFT JOIN public.wing_crawl_items ci ON ci.crawl_id = c.id
        WHERE c.user_id = p_user_id
        GROUP BY c.id
        HAVING COUNT(ci.id) = COALESCE((cfg->>'count')::int, 1)
      );

    ELSIF b.criteria_type = 'crawl_self_like' THEN
      earned := EXISTS (
        SELECT 1
        FROM public.wing_crawls c
        JOIN public.crawl_likes cl ON cl.crawl_id = c.id
        WHERE c.user_id = p_user_id AND cl.user_id = p_user_id
      );

    ELSIF b.criteria_type = 'crawl_desc_long' THEN
      earned := EXISTS (
        SELECT 1 FROM public.wing_crawls
        WHERE user_id = p_user_id
          AND description IS NOT NULL
          AND LENGTH(description) >= COALESCE((cfg->>'min_length')::int, 200)
      );

    ELSIF b.criteria_type = 'crawl_title_short' THEN
      earned := EXISTS (
        SELECT 1 FROM public.wing_crawls
        WHERE user_id = p_user_id
          AND LENGTH(TRIM(title)) > 0
          AND LENGTH(TRIM(title)) <= COALESCE((cfg->>'max_length')::int, 3)
      );

    ELSIF b.criteria_type = 'crawl_ranked' THEN
      earned := EXISTS (
        SELECT 1 FROM public.wing_crawls
        WHERE user_id = p_user_id AND is_ranked = true
      );

    ELSIF b.criteria_type = 'crawl_zero_likes_count' THEN
      earned := (
        SELECT COUNT(*)::int
        FROM public.wing_crawls c
        WHERE c.user_id = p_user_id
          AND NOT EXISTS (SELECT 1 FROM public.crawl_likes cl WHERE cl.crawl_id = c.id)
      ) >= COALESCE((cfg->>'count')::int, 3);

    ELSIF b.criteria_type = 'crawl_duplicate_title' THEN
      earned := EXISTS (
        SELECT 1 FROM public.wing_crawls
        WHERE user_id = p_user_id
        GROUP BY LOWER(TRIM(title))
        HAVING COUNT(*) >= 2
      );

    ELSIF b.criteria_type = 'crawl_same_day' THEN
      earned := EXISTS (
        SELECT 1 FROM public.wing_crawls
        WHERE user_id = p_user_id
        GROUP BY (created_at AT TIME ZONE 'UTC')::date
        HAVING COUNT(*) >= 2
      );

    END IF;

    IF earned THEN
      INSERT INTO public.user_badges (user_id, badge_id, event_id)
      VALUES (p_user_id, b.id, b.event_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;

-- ── 4. Recreate the crawl trigger fn so it calls BOTH evaluators ─────────────
-- (Faithful copy of 015's award_after_crawl_change + one extra PERFORM.)
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
    PERFORM public.award_crawl_funny_badges(v_owner);
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers themselves are unchanged from 015 (they already point at this fn),
-- so no CREATE TRIGGER needed.

-- ── 5. Backfill — award the new badges to anyone who already qualifies ───────
DO $$
DECLARE uid uuid;
BEGIN
  FOR uid IN SELECT DISTINCT user_id FROM public.wing_crawls LOOP
    PERFORM public.award_user_badges(uid);        -- handles Hoarder / Main Character
    PERFORM public.award_crawl_funny_badges(uid); -- handles the 8 new criteria types
  END LOOP;
END;
$$;
