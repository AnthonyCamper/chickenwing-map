import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CommentReaction } from '../lib/types'

interface RawReaction {
  review_id: string
  reaction_type: string
  user_id: string
}

interface ReviewReactionState {
  reactions: CommentReaction[]
  loading: boolean
}

/**
 * Hook to manage emoji reactions on a review.
 * Uses the same CommentReaction shape for UI consistency.
 */
export function useReviewReactions(
  reviewId: string,
  currentUserId: string
): {
  reactions: CommentReaction[]
  loading: boolean
  toggleReaction: (reactionType: string) => Promise<void>
} {
  const [state, setState] = useState<ReviewReactionState>({
    reactions: [],
    loading: true,
  })

  const fetchReactions = useCallback(async () => {
    const { data } = await supabase
      .from('review_reactions')
      .select('review_id, reaction_type, user_id')
      .eq('review_id', reviewId)

    const raws = (data ?? []) as RawReaction[]
    const aggregated = new Map<string, { count: number; is_mine: boolean }>()
    for (const r of raws) {
      const entry = aggregated.get(r.reaction_type) ?? { count: 0, is_mine: false }
      entry.count++
      if (r.user_id === currentUserId) entry.is_mine = true
      aggregated.set(r.reaction_type, entry)
    }

    const reactions: CommentReaction[] = Array.from(aggregated.entries()).map(
      ([reaction_type, { count, is_mine }]) => ({ reaction_type, count, is_mine })
    )

    setState({ reactions, loading: false })
  }, [reviewId, currentUserId])

  useEffect(() => {
    fetchReactions()
  }, [fetchReactions])

  const toggleReaction = useCallback(
    async (reactionType: string) => {
      const existing = state.reactions.find(r => r.reaction_type === reactionType)
      const isMine = existing?.is_mine ?? false

      // Optimistic update
      setState(prev => {
        const updated = prev.reactions.filter(r => r.reaction_type !== reactionType)
        if (!isMine) {
          updated.push({
            reaction_type: reactionType,
            count: (existing?.count ?? 0) + 1,
            is_mine: true,
          })
        } else if (existing && existing.count > 1) {
          updated.push({
            reaction_type: reactionType,
            count: existing.count - 1,
            is_mine: false,
          })
        }
        return { ...prev, reactions: updated }
      })

      try {
        if (isMine) {
          await supabase
            .from('review_reactions')
            .delete()
            .match({ review_id: reviewId, user_id: currentUserId, reaction_type: reactionType })
        } else {
          await supabase
            .from('review_reactions')
            .insert({ review_id: reviewId, user_id: currentUserId, reaction_type: reactionType })
        }
      } catch {
        // Revert on error
        setState(prev => ({ ...prev, reactions: state.reactions }))
      }
    },
    [reviewId, currentUserId, state.reactions]
  )

  return { reactions: state.reactions, loading: state.loading, toggleReaction }
}
