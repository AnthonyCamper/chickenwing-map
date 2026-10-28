-- ============================================================================
-- 039 — Review comments show the commenter's current name
-- ============================================================================
-- review_comments_detailed read profiles.full_name, which is set once at
-- sign-up; profile edits change display_name. Renamed users kept their old
-- name on every comment (crawl_comments_detailed already prefers
-- display_name). Same columns and order as before, so CREATE OR REPLACE is
-- safe; commenter_email stays NULL (email is not exposed to clients).
-- WITH (security_invoker) must be restated: CREATE OR REPLACE VIEW replaces
-- the view's options, and without it the view would bypass RLS.
-- ============================================================================

CREATE OR REPLACE VIEW public.review_comments_detailed WITH (security_invoker = true) AS
SELECT
  rc.id,
  rc.review_id,
  rc.user_id,
  rc.text,
  rc.created_at,
  rc.parent_comment_id,
  rc.content_type,
  rc.media_url,
  COALESCE(NULLIF(btrim(p.display_name), ''), p.full_name) AS commenter_name,
  p.avatar_url   AS commenter_avatar,
  NULL::text     AS commenter_email,
  coalesce(lk.cnt, 0)::int AS like_count,
  exists(
    SELECT 1 FROM public.review_comment_likes cl
    WHERE cl.comment_id = rc.id AND cl.user_id = auth.uid()
  ) AS is_liked_by_me,
  coalesce(rply.cnt, 0)::int AS reply_count
FROM public.review_comments rc
LEFT JOIN public.profiles p ON p.id = rc.user_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_comment_likes WHERE comment_id = rc.id
) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_comments child
  WHERE child.parent_comment_id = rc.id
) rply ON true;
