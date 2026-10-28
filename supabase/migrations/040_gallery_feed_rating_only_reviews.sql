-- ============================================================================
-- 040 — Discover includes reviews without photos, and exposes wing_size
-- ============================================================================
-- gallery_feed was one row per photo, so a review with only a rating (photos
-- and text are optional in the form) never appeared on Discover. It now has
-- one row per photo PLUS one row with NULL photo columns for each review that
-- has no photos; the client renders those as text cards. photo_created_at
-- falls back to the review's created_at so ordering still works.
-- wing_size is appended (CREATE OR REPLACE only allows new columns at the
-- end). Same security_invoker setting as 022.
-- ============================================================================

CREATE OR REPLACE VIEW public.gallery_feed WITH (security_invoker = true) AS
SELECT
  rp.id AS photo_id,
  rp.url AS photo_url,
  rp.display_order,
  COALESCE(rp.created_at, r.created_at) AS photo_created_at,
  r.id AS review_id,
  r.wing_spot_id,
  r.overall_rating,
  r.wing_flavor,
  r.review_text,
  r.visited_at,
  r.user_id AS reviewer_id,
  r.event_id,
  ws.name AS spot_name,
  ws.address AS spot_address,
  COALESCE(p.display_name, p.full_name) AS reviewer_name,
  p.avatar_url AS reviewer_avatar,
  NULL::text AS reviewer_email,
  COALESCE(lk.cnt, 0) AS like_count,
  COALESCE(cm.cnt, 0) AS comment_count,
  e.slug AS event_slug,
  e.name AS event_name,
  CASE
    WHEN auth.uid() IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.review_likes rl
      WHERE rl.review_id = r.id AND rl.user_id = auth.uid()
    )
    ELSE false
  END AS is_liked_by_me,
  ws.slug AS spot_slug,
  p.username AS reviewer_username,
  p.is_private AS reviewer_is_private,
  r.wing_flavors,
  r.wing_size
FROM public.reviews r
LEFT JOIN public.review_photos rp ON rp.review_id = r.id
JOIN public.wing_spots ws ON r.wing_spot_id = ws.id
JOIN public.profiles p ON r.user_id = p.id
LEFT JOIN public.events e ON e.id = r.event_id
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS cnt FROM public.review_likes WHERE review_likes.review_id = r.id
) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS cnt FROM public.review_comments WHERE review_comments.review_id = r.id
) cm ON true
ORDER BY COALESCE(rp.created_at, r.created_at) DESC;

GRANT SELECT ON public.gallery_feed TO anon, authenticated;
