-- ============================================================================
-- 001 — Unify engagement at the review level
-- ============================================================================
-- Mirrors the talias-coffee model: a review's photos are presented as a single
-- carousel card, so likes and comments live on the review (not on each photo).
--
-- Creates:
--   - review_comments              (parallel to photo_comments)
--   - review_comment_likes         (parallel to comment_likes)
--   - review_comment_reactions     (parallel to comment_reactions)
--   - review_likes                 (parallel to photo_likes)
--   - review_comments_detailed     (view consumed by useReviewComments)
-- Migrates existing rows from the per-photo tables to the per-review tables.
-- Updates gallery_feed to count review-level likes / comments.
--
-- This migration is idempotent on the schema side (CREATE IF NOT EXISTS,
-- ON CONFLICT DO NOTHING). After verifying the new tables behave correctly,
-- run the optional cleanup section at the bottom to drop the old tables.
-- ============================================================================

-- ── 1. review_comments ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_comments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id         uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text              text CHECK (
                      (text IS NOT NULL AND length(trim(text)) >= 1 AND length(text) <= 500)
                      OR (media_url IS NOT NULL AND length(trim(media_url)) >= 1)
                    ),
  parent_comment_id uuid REFERENCES public.review_comments(id) ON DELETE CASCADE,
  content_type      text NOT NULL DEFAULT 'text'
                    CHECK (content_type IN ('text', 'gif', 'mixed')),
  media_url         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_comments_review ON public.review_comments (review_id, created_at);
CREATE INDEX IF NOT EXISTS idx_review_comments_parent ON public.review_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can read review comments" ON public.review_comments;
DROP POLICY IF EXISTS "Approved users can insert own review comments" ON public.review_comments;
DROP POLICY IF EXISTS "Users can delete own review comments or admins any" ON public.review_comments;

CREATE POLICY "Approved users can read review comments"
  ON public.review_comments FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review comments"
  ON public.review_comments FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review comments or admins any"
  ON public.review_comments FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

GRANT SELECT, INSERT, DELETE ON public.review_comments TO authenticated;


-- ── 2. review_comment_likes ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_comment_likes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid NOT NULL REFERENCES public.review_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_comment_likes_comment ON public.review_comment_likes (comment_id);
ALTER TABLE public.review_comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can read review comment likes" ON public.review_comment_likes;
DROP POLICY IF EXISTS "Approved users can insert own review comment likes" ON public.review_comment_likes;
DROP POLICY IF EXISTS "Users can delete own review comment likes" ON public.review_comment_likes;

CREATE POLICY "Approved users can read review comment likes"
  ON public.review_comment_likes FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review comment likes"
  ON public.review_comment_likes FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review comment likes"
  ON public.review_comment_likes FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.review_comment_likes TO authenticated;


-- ── 3. review_comment_reactions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_comment_reactions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id    uuid NOT NULL REFERENCES public.review_comments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('👍','❤️','😂','🔥')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_review_comment_reactions_comment ON public.review_comment_reactions (comment_id);
ALTER TABLE public.review_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can read review comment reactions" ON public.review_comment_reactions;
DROP POLICY IF EXISTS "Approved users can insert own review comment reactions" ON public.review_comment_reactions;
DROP POLICY IF EXISTS "Users can delete own review comment reactions" ON public.review_comment_reactions;

CREATE POLICY "Approved users can read review comment reactions"
  ON public.review_comment_reactions FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review comment reactions"
  ON public.review_comment_reactions FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review comment reactions"
  ON public.review_comment_reactions FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.review_comment_reactions TO authenticated;


-- ── 4. review_likes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_likes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_likes_review ON public.review_likes (review_id);
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can read review likes" ON public.review_likes;
DROP POLICY IF EXISTS "Approved users can insert own review likes" ON public.review_likes;
DROP POLICY IF EXISTS "Users can delete own review likes" ON public.review_likes;

CREATE POLICY "Approved users can read review likes"
  ON public.review_likes FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review likes"
  ON public.review_likes FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review likes"
  ON public.review_likes FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.review_likes TO authenticated;


-- ── 5. Backfill review_comments from photo_comments ─────────────────────────
-- Each photo_comment is mapped to its review via review_photos.review_id.
-- Comments with the same (review_id, user_id, text, created_at) are deduped
-- so the same comment posted across multiple photos in one review collapses.
-- parent_comment_id is preserved when the parent's mapped row exists.

-- Step 5a: create a temporary mapping table from photo_comments.id to the
-- new review_comments.id (so we can rewrite parent_comment_id).
CREATE TEMP TABLE _comment_id_map (
  old_id uuid PRIMARY KEY,
  new_id uuid NOT NULL
) ON COMMIT DROP;

-- Step 5b: insert top-level comments first (parent_comment_id IS NULL)
WITH inserted AS (
  INSERT INTO public.review_comments (review_id, user_id, text, parent_comment_id, content_type, media_url, created_at)
  SELECT DISTINCT ON (rp.review_id, pc.user_id, pc.text, pc.media_url, pc.created_at)
    rp.review_id,
    pc.user_id,
    pc.text,
    NULL::uuid,
    pc.content_type,
    pc.media_url,
    pc.created_at
  FROM public.photo_comments pc
  JOIN public.review_photos rp ON rp.id = pc.photo_id
  WHERE pc.parent_comment_id IS NULL
  ORDER BY rp.review_id, pc.user_id, pc.text, pc.media_url, pc.created_at
  RETURNING id, review_id, user_id, text, media_url, created_at
)
INSERT INTO _comment_id_map (old_id, new_id)
SELECT pc.id, ins.id
FROM public.photo_comments pc
JOIN public.review_photos rp ON rp.id = pc.photo_id
JOIN inserted ins
  ON ins.review_id = rp.review_id
 AND ins.user_id   = pc.user_id
 AND ins.created_at = pc.created_at
 AND ins.text IS NOT DISTINCT FROM pc.text
 AND ins.media_url IS NOT DISTINCT FROM pc.media_url
WHERE pc.parent_comment_id IS NULL;

-- Step 5c: insert replies, mapping their parent ids
WITH inserted AS (
  INSERT INTO public.review_comments (review_id, user_id, text, parent_comment_id, content_type, media_url, created_at)
  SELECT
    rp.review_id,
    pc.user_id,
    pc.text,
    m.new_id,
    pc.content_type,
    pc.media_url,
    pc.created_at
  FROM public.photo_comments pc
  JOIN public.review_photos rp ON rp.id = pc.photo_id
  JOIN _comment_id_map m       ON m.old_id = pc.parent_comment_id
  WHERE pc.parent_comment_id IS NOT NULL
  RETURNING id, parent_comment_id, user_id, text, media_url, created_at
)
INSERT INTO _comment_id_map (old_id, new_id)
SELECT pc.id, ins.id
FROM public.photo_comments pc
JOIN inserted ins
  ON ins.parent_comment_id IS NOT NULL
 AND ins.user_id = pc.user_id
 AND ins.created_at = pc.created_at
 AND ins.text IS NOT DISTINCT FROM pc.text
 AND ins.media_url IS NOT DISTINCT FROM pc.media_url
WHERE pc.parent_comment_id IS NOT NULL
ON CONFLICT (old_id) DO NOTHING;


-- ── 6. Backfill review_comment_likes / review_comment_reactions ─────────────

INSERT INTO public.review_comment_likes (comment_id, user_id, created_at)
SELECT DISTINCT m.new_id, cl.user_id, cl.created_at
FROM public.comment_likes cl
JOIN _comment_id_map m ON m.old_id = cl.comment_id
ON CONFLICT (comment_id, user_id) DO NOTHING;

INSERT INTO public.review_comment_reactions (comment_id, user_id, reaction_type, created_at)
SELECT DISTINCT m.new_id, cr.user_id, cr.reaction_type, cr.created_at
FROM public.comment_reactions cr
JOIN _comment_id_map m ON m.old_id = cr.comment_id
ON CONFLICT (comment_id, user_id, reaction_type) DO NOTHING;


-- ── 7. Backfill review_likes from photo_likes ───────────────────────────────

INSERT INTO public.review_likes (review_id, user_id, created_at)
SELECT DISTINCT ON (rp.review_id, pl.user_id)
  rp.review_id,
  pl.user_id,
  pl.created_at
FROM public.photo_likes pl
JOIN public.review_photos rp ON rp.id = pl.photo_id
ORDER BY rp.review_id, pl.user_id, pl.created_at
ON CONFLICT (review_id, user_id) DO NOTHING;


-- ── 8. review_comments_detailed view ────────────────────────────────────────

CREATE OR REPLACE VIEW public.review_comments_detailed AS
SELECT
  rc.id,
  rc.review_id,
  rc.user_id,
  rc.text,
  rc.created_at,
  rc.parent_comment_id,
  rc.content_type,
  rc.media_url,
  p.full_name    AS commenter_name,
  p.avatar_url   AS commenter_avatar,
  p.email        AS commenter_email,
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

GRANT SELECT ON public.review_comments_detailed TO authenticated;


-- ── 9. Update gallery_feed to count review-level likes/comments ─────────────

DROP VIEW IF EXISTS public.gallery_feed;

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


-- ── 10. Notification trigger for review_comments ────────────────────────────
-- Notifies the review author when someone comments on their review.

CREATE OR REPLACE FUNCTION notify_review_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _review_owner uuid;
  _spot_name text;
  _actor_name text;
  _preview text;
  _parent_author uuid;
  _review_id uuid;
BEGIN
  SELECT r.user_id, ws.name, r.id
  INTO _review_owner, _spot_name, _review_id
  FROM reviews r
  JOIN wing_spots ws ON ws.id = r.wing_spot_id
  WHERE r.id = new.review_id;

  IF _review_owner IS NULL THEN RETURN new; END IF;

  _actor_name := get_display_name(new.user_id);

  IF new.content_type = 'gif' THEN
    _preview := _actor_name || ' sent a GIF on your review';
  ELSIF new.content_type = 'mixed' THEN
    _preview := _actor_name || ' commented: "' || left(new.text, 80) || '" + GIF';
  ELSE
    _preview := _actor_name || ' commented: "' || left(new.text, 80) || '"';
  END IF;

  IF new.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO _parent_author FROM review_comments WHERE id = new.parent_comment_id;
    IF _parent_author IS NOT NULL AND _parent_author != new.user_id THEN
      IF NOT recent_notification_exists(_parent_author, new.user_id, 'comment_reply'::notification_type, _review_id, null, null) THEN
        INSERT INTO notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
        VALUES (_parent_author, new.user_id, 'comment_reply'::notification_type, _review_id, _spot_name,
          _actor_name || ' replied to your comment');
      END IF;
    END IF;
  END IF;

  IF _review_owner != new.user_id THEN
    IF NOT recent_notification_exists(_review_owner, new.user_id, 'photo_comment'::notification_type, _review_id, null, null) THEN
      INSERT INTO notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
      VALUES (_review_owner, new.user_id, 'photo_comment'::notification_type, _review_id, _spot_name, _preview);
    END IF;
  END IF;

  INSERT INTO notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
  SELECT DISTINCT
    rc.user_id,
    new.user_id,
    'comment_reply'::notification_type,
    _review_id,
    _spot_name,
    _actor_name || ' also commented'
  FROM review_comments rc
  WHERE rc.review_id = new.review_id
    AND rc.user_id != new.user_id
    AND rc.user_id != _review_owner
    AND (rc.user_id != _parent_author OR _parent_author IS NULL)
    AND NOT recent_notification_exists(rc.user_id, new.user_id, 'comment_reply'::notification_type, _review_id, null, null);

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_review_comment ON review_comments;
CREATE TRIGGER trg_notify_review_comment
  AFTER INSERT ON review_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_comment();


-- ── 11. (Optional) Cleanup — run AFTER verifying app uses the new tables ────
-- These statements drop the photo-level tables and views. They are commented
-- out so the migration is non-destructive. Uncomment and re-run when ready:
--
-- DROP VIEW  IF EXISTS public.photo_comments_detailed;
-- DROP TABLE IF EXISTS public.comment_reactions  CASCADE;
-- DROP TABLE IF EXISTS public.comment_likes      CASCADE;
-- DROP TABLE IF EXISTS public.photo_comments     CASCADE;
-- DROP TABLE IF EXISTS public.photo_likes        CASCADE;
