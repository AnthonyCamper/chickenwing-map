-- ============================================================================
-- Rollback for 020_crawl_engagement_badges.sql
-- ============================================================================
-- Removes the engagement badges + triggers and restores the criteria_type
-- constraint to its post-019 form. (Does NOT re-create the 019 meta-badges.)
-- ============================================================================

-- ── 1. Drop the new triggers + trigger fn ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_award_after_crawl_comment ON public.crawl_comments;
DROP TRIGGER IF EXISTS trg_award_engagement_after_review ON public.reviews;
DROP FUNCTION IF EXISTS public.award_engagement_after_change();

-- ── 2. Remove the engagement badges (user_badges first for FK) ───────────────
DELETE FROM public.user_badges
WHERE badge_id IN (
  SELECT id FROM public.badges WHERE slug IN (
    'crawl-spoke-up', 'crawl-yapper', 'crawl-hot-take', 'crawl-hype-beast',
    'crawl-just-a-gif', 'crawl-reply-guy', 'rate-tough-crowd',
    'rate-cold-blooded', 'rate-serial-hater', 'rate-easy-lover'
  )
);
DELETE FROM public.badges WHERE slug IN (
  'crawl-spoke-up', 'crawl-yapper', 'crawl-hot-take', 'crawl-hype-beast',
  'crawl-just-a-gif', 'crawl-reply-guy', 'rate-tough-crowd',
  'rate-cold-blooded', 'rate-serial-hater', 'rate-easy-lover'
);

-- ── 3. Restore the funny evaluator to a no-op-safe stub ──────────────────────
CREATE OR REPLACE FUNCTION public.award_crawl_funny_badges(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN;
END;
$$;

-- ── 4. Restore the post-019 criteria_type constraint ─────────────────────────
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
