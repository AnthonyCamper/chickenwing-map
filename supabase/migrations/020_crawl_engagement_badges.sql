-- ============================================================================
-- 020 — Crawl engagement badges (replaces the 019 meta-badges)
-- ============================================================================
-- 019 added "funny" badges about trivial crawl PROPERTIES (empty list,
-- duplicate title, made-two-in-a-day…). Those are out. This migration replaces
-- them with badges for what you actually DO in/around crawls:
--   - what you SAY in crawl comments (count, hype, hate, GIF-only, reply guy)
--   - how you RATE (harsh low ratings, serial hater, easy lover)
--
-- crawl_comments columns (from 016): text, content_type, media_url, user_id,
-- crawl_id, parent_comment_id. A GIF comment has content_type='gif' /
-- media_url set.
--
-- Mechanics: a single evaluator, award_crawl_funny_badges(), is rewritten to
-- handle the new criteria types. It is fired by triggers on crawl_comments and
-- reviews (new) so activity earns badges live. Everyone is backfilled, so past
-- activity earns these immediately. award_user_badges is left untouched.
--
-- ADDITIVE + REVERSIBLE. Rollback: supabase/rollback/020_crawl_engagement_badges_rollback.sql
-- ============================================================================

-- ── 1. Remove the 019 meta-badges (user_badges first for FK) ─────────────────
DELETE FROM public.user_badges
WHERE badge_id IN (
  SELECT id FROM public.badges WHERE slug IN (
    'crawl-one-and-done', 'crawl-empty-promises', 'crawl-hoarder',
    'crawl-self-care', 'crawl-yapper', 'crawl-idk-lol', 'crawl-tier-lord',
    'crawl-nobody-asked', 'crawl-ctrl-c-ctrl-v', 'crawl-manic-episode',
    'crawl-main-character'
  )
);
DELETE FROM public.badges WHERE slug IN (
  'crawl-one-and-done', 'crawl-empty-promises', 'crawl-hoarder',
  'crawl-self-care', 'crawl-yapper', 'crawl-idk-lol', 'crawl-tier-lord',
  'crawl-nobody-asked', 'crawl-ctrl-c-ctrl-v', 'crawl-manic-episode',
  'crawl-main-character'
);

-- ── 2. Constraint: drop the 8 funny types, add the 6 engagement types ────────
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
  -- New crawl-engagement criteria
  'crawl_comment_count', 'crawl_comment_contains', 'crawl_comment_gif',
  'crawl_comment_on_others', 'rating_at_or_below', 'rating_at_or_above'
]));

-- ── 3. Seed the engagement badges ────────────────────────────────────────────
INSERT INTO public.badges (slug, name, description, icon, color, criteria_type, criteria_config, event_id, sort_order, is_active) VALUES
  -- What you SAY in crawls --------------------------------------------------
  ('crawl-spoke-up',
   'Spoke Up',
   'Dropped your first comment on a crawl. The council hears you.',
   '💬', 'sauce', 'crawl_comment_count', '{"count": 1}'::jsonb, NULL, 78, true),

  ('crawl-yapper',
   'Crawl Yapper',
   '10 comments across crawls. You do NOT log off. Respect.',
   '🗣️', 'sauce', 'crawl_comment_count', '{"count": 10}'::jsonb, NULL, 79, true),

  ('crawl-hot-take',
   'Hot Take',
   'Called a crawl mid / trash / overrated in the comments. Bold. Wrong, maybe. But bold.',
   '🧊', 'night', 'crawl_comment_contains', '{"pattern": "overrated|\\ytrash\\y|garbage|mediocre|\\ymid\\y|\\ynah\\y|\\yL\\y"}'::jsonb, NULL, 80, true),

  ('crawl-hype-beast',
   'Hype Beast',
   'Gassed up a crawl in the comments. Pure unfiltered hype energy.',
   '🔥', 'gold', 'crawl_comment_contains', '{"pattern": "fire|slaps|goated|\\yelite\\y|\\ypeak\\y|\\ygoat\\y|\\yW\\y"}'::jsonb, NULL, 81, true),

  ('crawl-just-a-gif',
   'No Words, Just GIF',
   'Replied to a crawl with a GIF instead of using your words. Cinema.',
   '🎞️', 'neon', 'crawl_comment_gif', '{}'::jsonb, NULL, 82, true),

  ('crawl-reply-guy',
   'Reply Guy',
   'Commented on a crawl that wasn''t yours. Always in someone''s mentions.',
   '🫵', 'sauce', 'crawl_comment_on_others', '{}'::jsonb, NULL, 83, true),

  -- How you RATE ------------------------------------------------------------
  ('rate-tough-crowd',
   'Tough Crowd',
   'Dropped a 3 or lower on some poor unsuspecting spot. Hard to impress.',
   '🧂', 'night', 'rating_at_or_below', '{"max_rating": 3, "count": 1}'::jsonb, NULL, 84, true),

  ('rate-cold-blooded',
   'Cold Blooded',
   'Handed out a 1.0. No notes, no mercy, no second date.',
   '💀', 'night', 'rating_at_or_below', '{"max_rating": 1, "count": 1}'::jsonb, NULL, 85, true),

  ('rate-serial-hater',
   'Serial Hater',
   '5+ reviews rated 4 or below. The wings fear you. As they should.',
   '📉', 'night', 'rating_at_or_below', '{"max_rating": 4, "count": 5}'::jsonb, NULL, 86, true),

  ('rate-easy-lover',
   'Easy Lover',
   '10+ reviews rated 9 or higher. Everything is the best thing you''ve ever eaten.',
   '💖', 'gold', 'rating_at_or_above', '{"min_rating": 9, "count": 10}'::jsonb, NULL, 87, true)
ON CONFLICT (slug) DO NOTHING;

-- ── 4. Rewrite the engagement evaluator for the new criteria types ───────────
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
        'crawl_comment_count', 'crawl_comment_contains', 'crawl_comment_gif',
        'crawl_comment_on_others', 'rating_at_or_below', 'rating_at_or_above'
      )
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.user_badges WHERE user_id = p_user_id AND badge_id = b.id
    ) THEN CONTINUE; END IF;

    cfg    := b.criteria_config;
    earned := false;

    IF b.criteria_type = 'crawl_comment_count' THEN
      earned := (
        SELECT COUNT(*)::int FROM public.crawl_comments cc WHERE cc.user_id = p_user_id
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'crawl_comment_contains' THEN
      earned := EXISTS (
        SELECT 1 FROM public.crawl_comments cc
        WHERE cc.user_id = p_user_id
          AND cc.text IS NOT NULL
          AND cc.text ~* (cfg->>'pattern')
      );

    ELSIF b.criteria_type = 'crawl_comment_gif' THEN
      earned := EXISTS (
        SELECT 1 FROM public.crawl_comments cc
        WHERE cc.user_id = p_user_id
          AND (cc.content_type = 'gif'
               OR (cc.media_url IS NOT NULL AND TRIM(cc.media_url) <> ''))
      );

    ELSIF b.criteria_type = 'crawl_comment_on_others' THEN
      earned := EXISTS (
        SELECT 1
        FROM public.crawl_comments cc
        JOIN public.wing_crawls c ON c.id = cc.crawl_id
        WHERE cc.user_id = p_user_id
          AND c.user_id <> p_user_id
      );

    ELSIF b.criteria_type = 'rating_at_or_below' THEN
      earned := (
        SELECT COUNT(*)::int FROM public.reviews
        WHERE user_id = p_user_id
          AND overall_rating <= COALESCE((cfg->>'max_rating')::numeric, 3)
      ) >= COALESCE((cfg->>'count')::int, 1);

    ELSIF b.criteria_type = 'rating_at_or_above' THEN
      earned := (
        SELECT COUNT(*)::int FROM public.reviews
        WHERE user_id = p_user_id
          AND overall_rating >= COALESCE((cfg->>'min_rating')::numeric, 9)
      ) >= COALESCE((cfg->>'count')::int, 1);

    END IF;

    IF earned THEN
      INSERT INTO public.user_badges (user_id, badge_id, event_id)
      VALUES (p_user_id, b.id, b.event_id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;

  END LOOP;
END;
$$;

-- ── 5. Trigger fn: run the evaluator for a row's owner ───────────────────────
CREATE OR REPLACE FUNCTION public.award_engagement_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.award_crawl_funny_badges(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- crawl_comments — "saying things in a crawl" badges
DROP TRIGGER IF EXISTS trg_award_after_crawl_comment ON public.crawl_comments;
CREATE TRIGGER trg_award_after_crawl_comment
  AFTER INSERT ON public.crawl_comments
  FOR EACH ROW EXECUTE FUNCTION public.award_engagement_after_change();

-- reviews — rating badges (alongside the existing review trigger)
DROP TRIGGER IF EXISTS trg_award_engagement_after_review ON public.reviews;
CREATE TRIGGER trg_award_engagement_after_review
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.award_engagement_after_change();

-- ── 6. Backfill — award to everyone with prior activity ──────────────────────
DO $$
DECLARE uid uuid;
BEGIN
  FOR uid IN
    SELECT user_id FROM public.reviews
    UNION
    SELECT user_id FROM public.crawl_comments
    UNION
    SELECT user_id FROM public.wing_crawls
  LOOP
    PERFORM public.award_crawl_funny_badges(uid);
  END LOOP;
END;
$$;
