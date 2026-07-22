-- ============================================================================
-- 024 — Public-site read parity for engagement tables
-- ============================================================================
-- With gallery_feed/reviews_with_profiles now security_invoker (022), anonymous
-- visitors on a PUBLIC site hit the approved-only SELECT policies on engagement
-- tables and saw 0 like/comment counts and empty threads. Reads on engagement
-- get the same is_site_public() OR is_approved() shape reviews already have;
-- flipping the site private locks all of it down together.
DROP POLICY "Approved users can read review likes" ON public.review_likes;
CREATE POLICY "Review likes: readable by approved users or public" ON public.review_likes
  FOR SELECT USING (is_site_public() OR is_approved());
DROP POLICY "Approved users can read review comments" ON public.review_comments;
CREATE POLICY "Review comments: readable by approved users or public" ON public.review_comments
  FOR SELECT USING (is_site_public() OR is_approved());
DROP POLICY "Approved users can read review reactions" ON public.review_reactions;
CREATE POLICY "Review reactions: readable by approved users or public" ON public.review_reactions
  FOR SELECT USING (is_site_public() OR is_approved());
