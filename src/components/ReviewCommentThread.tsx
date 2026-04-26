import { useEffect } from 'react'
import CommentSection from './gallery/CommentSection'
import { useReviewComments } from '../hooks/useReviewComments'
import { useAuthGate } from './AuthGateModal'
import { fetchReviewCommentLikers, fetchReviewCommentReactors } from '../lib/reactionDetails'

interface Props {
  reviewId: string
  currentUserId: string
  isAdmin: boolean
  onCommentCountChange?: (count: number) => void
}

export default function ReviewCommentThread({
  reviewId,
  currentUserId,
  isAdmin,
  onCommentCountChange,
}: Props) {
  const { requireAuth } = useAuthGate()
  const {
    comments,
    loading,
    addComment,
    deleteComment,
    toggleCommentLike,
    toggleReaction,
    fetchReplies,
  } = useReviewComments(reviewId, currentUserId)

  // Keep parent informed of total comment count (top-level + replies)
  useEffect(() => {
    if (!loading && onCommentCountChange) {
      const total = comments.reduce((sum, c) => sum + 1 + c.reply_count, 0)
      onCommentCountChange(total)
    }
  }, [comments, loading, onCommentCountChange])

  return (
    <CommentSection
      comments={comments}
      loading={loading}
      currentUserId={currentUserId}
      isAdmin={isAdmin}
      requireAuth={requireAuth}
      onAdd={addComment}
      onDelete={deleteComment}
      onToggleLike={toggleCommentLike}
      onToggleReaction={toggleReaction}
      onFetchReplies={fetchReplies}
      likersFetcher={fetchReviewCommentLikers}
      reactorsFetcher={fetchReviewCommentReactors}
    />
  )
}
