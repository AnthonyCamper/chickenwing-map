-- ============================================================================
-- 026 — Canadiana badges
-- ============================================================================
-- A pile of fun Ottawa/Canada-themed global badges. ADDITIVE:
--   - expands the criteria_type CHECK with 2 new types:
--       rating_exact     — gave a review rated exactly {value} (e.g. 6.7 → 1867)
--       flavor_contains  — reviewed wings whose flavor contains {text}
--   - seeds 17 badge rows; 11 reuse existing criteria types
--     (review_text_contains / review_count / unique_spots / takeout_count)
--     so award_user_badges already handles them
--   - adds a SEPARATE evaluator, award_canadiana_badges(), for the 2 new
--     types; award_user_badges is NOT modified (it skips unknown types)
--   - award_engagement_after_change (review trigger) now calls the new
--     evaluator too
--   - backfills all approved users
--
-- Icons are keys into the frontend SVG registry
-- (src/components/badges/BadgeIcon.tsx) and must stay in sync with it.
-- ============================================================================

-- ── 1. Expand criteria_type constraint (all live values + 2 new) ─────────────
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
  'crawl_comment_count', 'crawl_comment_contains', 'crawl_comment_gif', 'crawl_comment_on_others',
  'rating_at_or_below', 'rating_at_or_above',
  -- New Canadiana criteria
  'rating_exact', 'flavor_contains'
]));

-- ── 2. Seed the Canadiana badges ─────────────────────────────────────────────
INSERT INTO public.badges (slug, name, description, icon, color, criteria_type, criteria_config, event_id, sort_order, is_active) VALUES
  -- Rating easter eggs (rating_exact)
  ('canadiana-confederation',
   'Confederation',
   'Dropped a 6.7. Est. 1867.',
   'shield-1867', 'gold', 'rating_exact', '{"value": 6.7}'::jsonb, NULL, 120, true),

  ('canadiana-canada-day',
   'Canada Day',
   'Rated a 7.1 — July 1st energy.',
   'firework', 'sauce', 'rating_exact', '{"value": 7.1}'::jsonb, NULL, 121, true),

  ('canadiana-skateway',
   'The Skateway',
   'A 7.8 — one point for every kilometre of the Rideau Canal Skateway.',
   'skateway', 'night', 'rating_exact', '{"value": 7.8}'::jsonb, NULL, 122, true),

  ('canadiana-great-one',
   'The Great One',
   'Gave a 9.9. The number of The Great One himself.',
   'jersey-99', 'gold', 'rating_exact', '{"value": 9.9}'::jsonb, NULL, 123, true),

  ('canadiana-loonie',
   'The Loonie',
   'A flat 1.0. Worth exactly one dollar.',
   'loon-coin', 'gold', 'rating_exact', '{"value": 1.0}'::jsonb, NULL, 124, true),

  ('canadiana-toonie',
   'The Toonie',
   'A flat 2.0. Twice the coin, same disappointment.',
   'toonie', 'night', 'rating_exact', '{"value": 2.0}'::jsonb, NULL, 125, true),

  -- Said-the-thing badges (review_text_contains; handled by award_user_badges)
  ('canadiana-poutine',
   'Side of Poutine',
   'Mentioned poutine in a wing review. Priorities intact.',
   'poutine', 'amber', 'review_text_contains',
   '{"pattern": "\\ypoutines?\\y", "hint": "Mention poutine in a review."}'::jsonb, NULL, 126, true),

  ('canadiana-extra-u',
   'The Extra U',
   'Reviewed in Canadian English. The u is silent but proud.',
   'letter-u', 'night', 'review_text_contains',
   '{"pattern": "\\y(flavour|favourite|colour|honour|neighbour|savoury)", "hint": "Use a Canadian spelling — flavour, favourite, colour — in a review."}'::jsonb, NULL, 127, true),

  ('canadiana-sorry',
   'National Reflex',
   'Said sorry in a wing review. To whom? Unclear.',
   'speech-heart', 'sauce', 'review_text_contains',
   '{"pattern": "\\ysorry\\y", "hint": "Type the word ''sorry'' in a review."}'::jsonb, NULL, 128, true),

  ('canadiana-tapped',
   'Tapped',
   'Mentioned maple. The syrup runs deep.',
   'sap-pail', 'amber', 'review_text_contains',
   '{"pattern": "\\ymaple\\y", "hint": "Mention maple in a review."}'::jsonb, NULL, 129, true),

  ('canadiana-rink-rat',
   'Rink Rat',
   'Brought hockey into a wing review. As is right.',
   'crossed-sticks', 'night', 'review_text_contains',
   '{"pattern": "\\y(hockey|senators|sens)\\y", "hint": "Mention hockey (or the Sens) in a review."}'::jsonb, NULL, 130, true),

  ('canadiana-timmies',
   'Timmies Run',
   'Name-dropped Timmies in a review. Double double implied.',
   'donut', 'amber', 'review_text_contains',
   '{"pattern": "\\y(tim hortons|timmies|timbits?)\\y", "hint": "Mention Tim Hortons, Timmies, or Timbits in a review."}'::jsonb, NULL, 131, true),

  -- Flavor (flavor_contains)
  ('canadiana-honey-garlic',
   'The Honey Garlic Accord',
   'Ordered honey garlic — the most Canadian treaty ever signed.',
   'garlic-honey', 'gold', 'flavor_contains', '{"text": "honey garlic"}'::jsonb, NULL, 132, true),

  -- Canadian numbers (existing count criteria)
  ('canadiana-alfie',
   'The Alfie',
   '11 reviews — the captain''s number, raised to the rafters.',
   'banner-11', 'sauce', 'review_count', '{"count": 11}'::jsonb, NULL, 133, true),

  ('canadiana-two-four',
   'The Two-Four',
   '24 reviews. A full flat for the long weekend.',
   'two-four', 'amber', 'review_count', '{"count": 24}'::jsonb, NULL, 134, true),

  ('canadiana-snowbirds',
   'The Snowbirds',
   'Reviewed 9 different spots — a full formation.',
   'jets', 'night', 'unique_spots', '{"count": 9}'::jsonb, NULL, 135, true),

  ('canadiana-snow-day',
   'Snow Day',
   '10 takeout orders. It was -30 out and you made the right call.',
   'snowflake', 'night', 'takeout_count', '{"count": 10}'::jsonb, NULL, 136, true)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. Evaluator for the two new criteria types ──────────────────────────────
-- Kept separate from award_user_badges (which skips unknown criteria types).
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
      AND criteria_type IN ('rating_exact', 'flavor_contains')
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = b.id
    ) THEN CONTINUE; END IF;

    cfg    := b.criteria_config;
    earned := false;

    IF b.criteria_type = 'rating_exact' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id
          AND overall_rating = (cfg->>'value')::numeric
      );

    ELSIF b.criteria_type = 'flavor_contains' THEN
      earned := EXISTS (
        SELECT 1 FROM public.reviews
        WHERE user_id = p_user_id
          AND LOWER(wing_flavor) LIKE '%' || LOWER(cfg->>'text') || '%'
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

-- ── 4. Review trigger fn now calls the new evaluator too ─────────────────────
-- (award_engagement_after_change fires on reviews; ratings/flavors only
-- change there.)
CREATE OR REPLACE FUNCTION public.award_engagement_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.award_crawl_funny_badges(NEW.user_id);
    PERFORM public.award_canadiana_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. Backfill — award to anyone who already qualifies ──────────────────────
DO $$
DECLARE uid uuid;
BEGIN
  FOR uid IN SELECT id FROM public.profiles WHERE status = 'approved' LOOP
    PERFORM public.award_user_badges(uid);
    PERFORM public.award_canadiana_badges(uid);
  END LOOP;
END;
$$;
