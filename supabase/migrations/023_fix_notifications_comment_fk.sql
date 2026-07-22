-- ============================================================================
-- 023 — Repoint notifications.comment_id FK to review_comments
-- ============================================================================
-- notifications.comment_id still referenced the dead legacy photo_comments
-- table, but notify_review_comment writes review_comments ids into it. The FK
-- violation aborted the whole comment INSERT, so commenting on anyone else's
-- review has been broken in prod (self-comments skip the trigger — which is
-- why it looked fine to the review owner). photo_comments is empty, so every
-- existing notifications.comment_id is NULL and the swap is safe.
ALTER TABLE public.notifications DROP CONSTRAINT notifications_comment_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_comment_id_fkey
  FOREIGN KEY (comment_id) REFERENCES public.review_comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notifications_comment_id ON public.notifications(comment_id);
