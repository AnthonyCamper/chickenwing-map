-- ============================================================================
-- 021 — review_reactions (emoji reactions directly on a review)
-- ============================================================================
-- The app already references this table everywhere:
--   - src/hooks/useReviewReactions.ts        (insert/delete/select)
--   - src/lib/reactionDetails.ts             (fetchReviewReactors)
--   - ReactionPicker rendered on every ReviewCard
-- ...but the table was never created, so reacting to a review silently no-ops
-- (Supabase returns an error object instead of throwing). This adds it,
-- mirroring review_comment_reactions.
--
-- Emoji set: ReactionPicker offers 👍 ❤️ 😂 🔥 😍 👏 PLUS a full emoji picker,
-- so the reaction_type is NOT restricted to a 4-emoji whitelist (that whitelist
-- is exactly why some reactions failed). We only bound the length.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.review_reactions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id     uuid NOT NULL REFERENCES public.reviews(id)  ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (char_length(reaction_type) BETWEEN 1 AND 16),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_review_reactions_review ON public.review_reactions (review_id);

ALTER TABLE public.review_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved users can read review reactions" ON public.review_reactions;
DROP POLICY IF EXISTS "Approved users can insert own review reactions" ON public.review_reactions;
DROP POLICY IF EXISTS "Users can delete own review reactions" ON public.review_reactions;

CREATE POLICY "Approved users can read review reactions"
  ON public.review_reactions FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review reactions"
  ON public.review_reactions FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review reactions"
  ON public.review_reactions FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.review_reactions TO authenticated;


-- ── Relax the comment-reaction whitelist ────────────────────────────────────
-- review_comment_reactions only allowed 👍 ❤️ 😂 🔥, so 😍 / 👏 / any full-picker
-- emoji silently violated the CHECK and failed. Match the review_reactions rule.

ALTER TABLE public.review_comment_reactions
  DROP CONSTRAINT IF EXISTS review_comment_reactions_reaction_type_check;
ALTER TABLE public.review_comment_reactions
  ADD CONSTRAINT review_comment_reactions_reaction_type_check
  CHECK (char_length(reaction_type) BETWEEN 1 AND 16);
