-- The wing_crawls_detailed view runs as SECURITY DEFINER (Postgres default),
-- so it bypasses RLS on wing_crawls. Without explicit filtering, anyone could
-- read private crawls through the view. Add an explicit visibility WHERE
-- clause as defense-in-depth (matches the wing_crawls RLS policy).

CREATE OR REPLACE VIEW public.wing_crawls_detailed AS
SELECT
  c.id,
  c.user_id,
  c.slug,
  c.title,
  c.description,
  c.cover_image_url,
  c.is_public,
  c.is_ranked,
  c.created_at,
  c.updated_at,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN 'Private wing-logger'
    ELSE COALESCE(p.display_name, p.full_name) END AS author_name,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN NULL ELSE p.avatar_url END AS author_avatar,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN NULL ELSE p.username END AS author_username,
  CASE WHEN p.id = auth.uid() THEN false ELSE p.is_private END AS author_is_private,
  (SELECT COUNT(*) FROM public.wing_crawl_items ci WHERE ci.crawl_id = c.id)::integer AS item_count
FROM public.wing_crawls c
JOIN public.profiles p ON p.id = c.user_id
WHERE c.is_public = true OR c.user_id = auth.uid();
