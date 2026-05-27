-- Phase 1 follow-up: expose spot_slug, reviewer_username, reviewer_is_private
-- in the views the gallery and list UIs depend on. CREATE OR REPLACE VIEW
-- requires existing columns stay in the same position, so new columns are
-- appended at the end.

CREATE OR REPLACE VIEW public.gallery_feed AS
SELECT rp.id AS photo_id,
    rp.url AS photo_url,
    rp.display_order,
    rp.created_at AS photo_created_at,
    rp.review_id,
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
    p.email AS reviewer_email,
    COALESCE(lk.cnt, 0) AS like_count,
    COALESCE(cm.cnt, 0) AS comment_count,
    e.slug AS event_slug,
    e.name AS event_name,
    CASE
      WHEN auth.uid() IS NOT NULL THEN (EXISTS ( SELECT 1
         FROM review_likes rl
        WHERE rl.review_id = r.id AND rl.user_id = auth.uid()))
      ELSE false
    END AS is_liked_by_me,
    ws.slug AS spot_slug,
    p.username AS reviewer_username,
    p.is_private AS reviewer_is_private
   FROM review_photos rp
     JOIN reviews r ON rp.review_id = r.id
     JOIN wing_spots ws ON r.wing_spot_id = ws.id
     JOIN profiles p ON r.user_id = p.id
     LEFT JOIN events e ON e.id = r.event_id
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS cnt
           FROM review_likes
          WHERE review_likes.review_id = r.id) lk ON true
     LEFT JOIN LATERAL ( SELECT count(*)::integer AS cnt
           FROM review_comments
          WHERE review_comments.review_id = r.id) cm ON true
  ORDER BY rp.created_at DESC;

CREATE OR REPLACE VIEW public.reviews_with_profiles AS
SELECT r.id,
    r.wing_spot_id,
    r.user_id,
    r.overall_rating,
    r.wing_size,
    r.wing_flavor,
    r.is_takeout,
    r.takeout_container,
    r.review_text,
    r.visited_at,
    r.legacy_data,
    r.event_id,
    r.event_stop_id,
    r.created_at,
    r.updated_at,
    p.display_name AS reviewer_name,
    p.avatar_url AS reviewer_avatar,
    p.email AS reviewer_email,
    ws.name AS spot_name,
    ws.address AS spot_address,
    ws.lat AS spot_lat,
    ws.lng AS spot_lng,
    e.slug AS event_slug,
    e.name AS event_name,
    ws.slug AS spot_slug,
    p.username AS reviewer_username,
    p.is_private AS reviewer_is_private
   FROM reviews r
     JOIN profiles p ON p.id = r.user_id
     JOIN wing_spots ws ON ws.id = r.wing_spot_id
     LEFT JOIN events e ON e.id = r.event_id;
