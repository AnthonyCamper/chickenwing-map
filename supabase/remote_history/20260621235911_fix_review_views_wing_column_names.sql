-- 006_fix_review_views_wing_column_names.sql
--
-- Prod symptom: reviews rendered with NO details (blank rating / flavor / text /
-- spot). Root cause: gallery_feed and reviews_with_profiles joined the correct
-- wing tables (reviews, wing_spots) but still exposed COFFEE-ERA output column
-- names from a half-finished migration:
--   r.overall_rating AS coffee_rating / vibe_rating
--   r.wing_flavor    AS coffee_type
--   r.review_text    AS note
--   ws.name          AS shop_name
--   r.wing_spot_id   AS shop_id / coffee_shop_id
-- The app reads overall_rating, wing_flavor, review_text, spot_name, wing_spot_id,
-- event_* -> every one came back undefined -> blank cards. Data was intact.
--
-- Fix: recreate both views with the column names the app expects, add the event
-- join (event_id / event_slug / event_name), and preserve decimal ratings (no
-- ::integer cast). Joins, like/comment counts, privacy, and definer security are
-- otherwise unchanged. Note: gallery_feed/social_feed only differ by an extra
-- is_following_reviewer column; the social feed reuses gallery_feed with a follow
-- filter in the app, so only the two consumed views are corrected here.

DROP VIEW IF EXISTS public.gallery_feed;
DROP VIEW IF EXISTS public.reviews_with_profiles;

CREATE VIEW public.reviews_with_profiles AS
SELECT
  r.id,
  r.wing_spot_id,
  r.user_id,
  r.overall_rating,
  r.wing_size,
  r.wing_flavor,
  r.is_takeout,
  r.takeout_container,
  r.review_text,
  r.legacy_data,
  r.event_id,
  r.event_stop_id,
  e.slug AS event_slug,
  e.name AS event_name,
  r.visited_at,
  r.created_at,
  r.updated_at,
  COALESCE(p.display_name, p.full_name) AS reviewer_name,
  p.avatar_url AS reviewer_avatar,
  p.email AS reviewer_email,
  p.username AS reviewer_username,
  ws.name AS spot_name,
  ws.address AS spot_address
FROM reviews r
JOIN profiles p ON p.id = r.user_id
JOIN wing_spots ws ON ws.id = r.wing_spot_id
LEFT JOIN events e ON e.id = r.event_id;

CREATE VIEW public.gallery_feed AS
SELECT
  rp.id AS photo_id,
  rp.url AS photo_url,
  rp.display_order,
  rp.created_at AS photo_created_at,
  r.id AS review_id,
  r.overall_rating,
  r.wing_flavor,
  r.review_text,
  r.visited_at,
  r.wing_spot_id,
  ws.name AS spot_name,
  ws.address AS spot_address,
  r.user_id AS reviewer_id,
  COALESCE(p.display_name, p.full_name) AS reviewer_name,
  p.avatar_url AS reviewer_avatar,
  p.email AS reviewer_email,
  p.username AS reviewer_username,
  r.event_id,
  e.slug AS event_slug,
  e.name AS event_name,
  COALESCE(lk.cnt, 0) AS like_count,
  COALESCE(cm.cnt, 0) AS comment_count,
  CASE
    WHEN auth.uid() IS NOT NULL THEN (EXISTS (
      SELECT 1 FROM review_likes rl
      WHERE rl.review_id = r.id AND rl.user_id = auth.uid()))
    ELSE false
  END AS is_liked_by_me
FROM review_photos rp
JOIN reviews r ON rp.review_id = r.id
JOIN wing_spots ws ON r.wing_spot_id = ws.id
JOIN profiles p ON r.user_id = p.id
LEFT JOIN events e ON e.id = r.event_id
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS cnt FROM review_likes
  WHERE review_likes.review_id = r.id) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS cnt FROM review_comments
  WHERE review_comments.review_id = r.id) cm ON true
ORDER BY rp.created_at DESC;

GRANT SELECT ON public.gallery_feed TO anon, authenticated;
GRANT SELECT ON public.reviews_with_profiles TO anon, authenticated;
