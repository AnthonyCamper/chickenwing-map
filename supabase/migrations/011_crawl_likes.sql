-- Likes on crawls. Mirrors review_likes shape but reads are open (no
-- is_approved() gate) so anon users in public mode can see counts via the
-- detailed view.

CREATE TABLE public.crawl_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id   uuid NOT NULL REFERENCES public.wing_crawls(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crawl_id, user_id)
);

CREATE INDEX crawl_likes_crawl_id_idx ON public.crawl_likes(crawl_id);

ALTER TABLE public.crawl_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crawl likes: open read"
  ON public.crawl_likes FOR SELECT USING (true);

CREATE POLICY "Crawl likes: insert own"
  ON public.crawl_likes FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Crawl likes: delete own"
  ON public.crawl_likes FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.crawl_likes TO authenticated;
GRANT SELECT ON public.crawl_likes TO anon;

-- Extend wing_crawls_detailed with like_count + is_liked_by_me. CREATE OR
-- REPLACE VIEW requires existing columns to stay in position; new ones go
-- at the end.

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
  (SELECT COUNT(*) FROM public.wing_crawl_items ci WHERE ci.crawl_id = c.id)::integer AS item_count,
  (SELECT COUNT(*) FROM public.crawl_likes cl WHERE cl.crawl_id = c.id)::integer AS like_count,
  CASE
    WHEN auth.uid() IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.crawl_likes cl
      WHERE cl.crawl_id = c.id AND cl.user_id = auth.uid()
    )
    ELSE false
  END AS is_liked_by_me
FROM public.wing_crawls c
JOIN public.profiles p ON p.id = c.user_id
WHERE c.is_public = true OR c.user_id = auth.uid();
