-- Crawl comments — threaded, with likes and reactions. Mirrors the
-- review_comments / review_comment_likes / review_comment_reactions trio.

-- ── 1. crawl_comments ────────────────────────────────────────────────────
CREATE TABLE public.crawl_comments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id          uuid NOT NULL REFERENCES public.wing_crawls(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text              text,
  parent_comment_id uuid REFERENCES public.crawl_comments(id) ON DELETE CASCADE,
  content_type      text NOT NULL DEFAULT 'text',
  media_url         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX crawl_comments_crawl_id_idx ON public.crawl_comments(crawl_id);
CREATE INDEX crawl_comments_parent_idx ON public.crawl_comments(parent_comment_id);

ALTER TABLE public.crawl_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crawl comments: read via parent crawl"
  ON public.crawl_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.wing_crawls c
    WHERE c.id = crawl_comments.crawl_id
      AND (c.is_public = true OR c.user_id = auth.uid())
  ));

CREATE POLICY "Crawl comments: insert self on readable crawl"
  ON public.crawl_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.wing_crawls c
      WHERE c.id = crawl_comments.crawl_id
        AND (c.is_public = true OR c.user_id = auth.uid())
    )
  );

CREATE POLICY "Crawl comments: delete self or crawl owner"
  ON public.crawl_comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.wing_crawls c
      WHERE c.id = crawl_comments.crawl_id AND c.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, DELETE ON public.crawl_comments TO authenticated;
GRANT SELECT ON public.crawl_comments TO anon;

-- ── 2. crawl_comment_likes ───────────────────────────────────────────────
CREATE TABLE public.crawl_comment_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.crawl_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX crawl_comment_likes_comment_idx ON public.crawl_comment_likes(comment_id);

ALTER TABLE public.crawl_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crawl comment likes: open read" ON public.crawl_comment_likes FOR SELECT USING (true);
CREATE POLICY "Crawl comment likes: insert self" ON public.crawl_comment_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Crawl comment likes: delete self" ON public.crawl_comment_likes FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.crawl_comment_likes TO authenticated;
GRANT SELECT ON public.crawl_comment_likes TO anon;

-- ── 3. crawl_comment_reactions ───────────────────────────────────────────
CREATE TABLE public.crawl_comment_reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id    uuid NOT NULL REFERENCES public.crawl_comments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, reaction_type)
);

CREATE INDEX crawl_comment_reactions_comment_idx ON public.crawl_comment_reactions(comment_id);

ALTER TABLE public.crawl_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crawl comment reactions: open read" ON public.crawl_comment_reactions FOR SELECT USING (true);
CREATE POLICY "Crawl comment reactions: insert self" ON public.crawl_comment_reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Crawl comment reactions: delete self" ON public.crawl_comment_reactions FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.crawl_comment_reactions TO authenticated;
GRANT SELECT ON public.crawl_comment_reactions TO anon;

-- ── 4. crawl_comments_detailed view ──────────────────────────────────────
CREATE VIEW public.crawl_comments_detailed AS
SELECT
  cc.id,
  cc.crawl_id,
  cc.user_id,
  cc.text,
  cc.created_at,
  cc.parent_comment_id,
  cc.content_type,
  cc.media_url,
  COALESCE(p.display_name, p.full_name) AS commenter_name,
  p.avatar_url AS commenter_avatar,
  p.email AS commenter_email,
  COALESCE(lk.cnt, 0) AS like_count,
  (EXISTS (
    SELECT 1 FROM public.crawl_comment_likes cl
    WHERE cl.comment_id = cc.id AND cl.user_id = auth.uid()
  )) AS is_liked_by_me,
  COALESCE(rply.cnt, 0) AS reply_count
FROM public.crawl_comments cc
LEFT JOIN public.profiles p ON p.id = cc.user_id
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS cnt
  FROM public.crawl_comment_likes
  WHERE crawl_comment_likes.comment_id = cc.id
) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS cnt
  FROM public.crawl_comments child
  WHERE child.parent_comment_id = cc.id
) rply ON true;
