-- ============================================================================
-- 002 — Decimal ratings (0.1 increments)
-- ============================================================================
-- Promotes reviews.overall_rating from an integer to numeric(3,1) so users
-- can pick fractional values like 7.4 or 9.8. Existing integer ratings cast
-- losslessly (8 → 8.0).
--
-- Anything that consumes the column gets dropped + recreated:
--   - reviews_with_profiles  (if it exists)
--   - gallery_feed
-- ============================================================================

-- ── 1. Drop dependent views ─────────────────────────────────────────────────

DROP VIEW IF EXISTS public.reviews_with_profiles;
DROP VIEW IF EXISTS public.gallery_feed;


-- ── 2. Relax check constraint, change column type ───────────────────────────

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_overall_rating_check;

ALTER TABLE public.reviews
  ALTER COLUMN overall_rating TYPE numeric(3,1)
  USING overall_rating::numeric(3,1);

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_overall_rating_check
  CHECK (overall_rating >= 1.0 AND overall_rating <= 10.0
         AND overall_rating = round(overall_rating, 1));


-- ── 3. Recreate gallery_feed (now selecting numeric overall_rating) ─────────

CREATE OR REPLACE VIEW public.gallery_feed AS
SELECT
  rp.id                                                        AS photo_id,
  rp.url                                                       AS photo_url,
  rp.display_order,
  rp.created_at                                                AS photo_created_at,
  r.id                                                         AS review_id,
  r.overall_rating,
  r.wing_size,
  r.wing_flavor,
  r.is_takeout,
  r.takeout_container,
  r.review_text,
  r.visited_at,
  ws.id                                                        AS wing_spot_id,
  ws.name                                                      AS spot_name,
  ws.address                                                   AS spot_address,
  p.id                                                         AS reviewer_id,
  p.full_name                                                  AS reviewer_name,
  p.avatar_url                                                 AS reviewer_avatar,
  p.email                                                      AS reviewer_email,
  coalesce(lk.cnt, 0)::int                                     AS like_count,
  coalesce(cm.cnt, 0)::int                                     AS comment_count,
  EXISTS(
    SELECT 1 FROM public.review_likes rl
    WHERE rl.review_id = r.id AND rl.user_id = auth.uid()
  )                                                            AS is_liked_by_me
FROM public.review_photos rp
JOIN  public.reviews     r  ON r.id  = rp.review_id
JOIN  public.wing_spots  ws ON ws.id = r.wing_spot_id
LEFT JOIN public.profiles p  ON p.id  = r.user_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_likes WHERE review_id = r.id
) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_comments WHERE review_id = r.id
) cm ON true;

GRANT SELECT ON public.gallery_feed TO authenticated;


-- ── 4. Recreate reviews_with_profiles if it existed ─────────────────────────
-- This view is referenced in CLAUDE.md but not in migrations. Recreate with a
-- permissive shape so any pre-existing column set is preserved.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wing_spots') THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.reviews_with_profiles AS
      SELECT
        r.*,
        ws.name    AS spot_name,
        ws.address AS spot_address,
        ws.lat     AS spot_lat,
        ws.lng     AS spot_lng,
        p.full_name  AS reviewer_name,
        p.avatar_url AS reviewer_avatar,
        p.email      AS reviewer_email
      FROM public.reviews r
      JOIN public.wing_spots ws ON ws.id = r.wing_spot_id
      LEFT JOIN public.profiles p ON p.id = r.user_id;
    $view$;

    GRANT SELECT ON public.reviews_with_profiles TO authenticated;
  END IF;
END $$;
