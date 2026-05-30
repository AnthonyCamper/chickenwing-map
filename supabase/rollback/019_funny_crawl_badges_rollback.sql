-- ============================================================================
-- Rollback for 019_funny_crawl_badges.sql
-- ============================================================================
-- Removes the funny badges, the dedicated evaluator, restores the 015 trigger
-- function, and restores the criteria_type constraint to its 015 form.
-- ============================================================================

-- ── 1. Remove user_badges + badges for the funny slugs ───────────────────────
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

-- ── 2. Drop the dedicated evaluator ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.award_crawl_funny_badges(uuid);

-- ── 3. Restore 015's trigger function (drops the extra PERFORM) ──────────────
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

-- ── 4. Restore the 015 criteria_type constraint ──────────────────────────────
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
  'first_crawl', 'crawl_with_n_spots', 'crawl_with_n_likes', 'crawl_count'
]));
