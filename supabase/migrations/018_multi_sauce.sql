-- ============================================================================
-- 018 — Multiple sauces per review
-- ============================================================================
-- Adds reviews.wing_flavors (text[]) so a review can carry more than one
-- sauce/flavor. ADDITIVE and REVERSIBLE:
--   - new column defaults to '{}' (never null)
--   - backfilled by splitting the legacy wing_flavor string on ', '
--   - wing_flavor is RETAINED and dual-written by the app (as the comma-joined
--     string) for one release, so:
--       (a) the previous client bundle keeps working, and
--       (b) award_user_badges keeps reading wing_flavor unchanged — the
--           flavor badges (lemon_pepper / ranch_fan / heat_seeker) substring-
--           match the joined string, and flavor_variety behaves exactly as it
--           does today. NO badge logic changes here.
--   - views expose BOTH columns (wing_flavors appended at the end) so the app
--     can read the array for display/editing.
--
-- The contract step (later migration) drops wing_flavor; ONLY THEN must
-- award_user_badges be switched to read the array.
--
-- Rollback: supabase/rollback/018_multi_sauce_rollback.sql
-- ============================================================================

-- ── 1. Column ───────────────────────────────────────────────────────────────
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS wing_flavors text[] NOT NULL DEFAULT '{}';

-- ── 2. Backfill: split legacy string on commas, trim, drop empty tokens. ─────
-- NULL / '' / 'NONE' rows keep the default empty array. "Unknown" tokens are
-- intentionally preserved per product decision.
UPDATE public.reviews
SET wing_flavors = COALESCE((
  SELECT array_agg(trim(x))
  FROM unnest(string_to_array(wing_flavor, ',')) AS x
  WHERE trim(x) <> ''
), '{}')
WHERE wing_flavor IS NOT NULL
  AND trim(wing_flavor) <> ''
  AND upper(trim(wing_flavor)) <> 'NONE';

-- ── 3. Recreate reviews_with_profiles (wing_flavors appended at end) ─────────
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
    p.is_private AS reviewer_is_private,
    r.wing_flavors
   FROM reviews r
     JOIN profiles p ON p.id = r.user_id
     JOIN wing_spots ws ON ws.id = r.wing_spot_id
     LEFT JOIN events e ON e.id = r.event_id;

-- ── 4. Recreate gallery_feed (wing_flavors appended at end) ──────────────────
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
    p.is_private AS reviewer_is_private,
    r.wing_flavors
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
