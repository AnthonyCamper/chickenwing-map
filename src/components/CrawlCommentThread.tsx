import { useEffect } from 'react'
import CommentSection from './gallery/CommentSection'
import { useCrawlComments } from '../hooks/useCrawlComments'
import { useAuthGate } from './AuthGateModal'
import { fetchCrawlCommentLikers, fetchCrawlCommentReactors } from '../lib/reactionDetails'

interface Props {
  crawlId: string
  currentUserId: string
  isAdmin: boolean
  onCommentCountChange?: (count: number) => void
}

export default function CrawlCommentThread({
  crawlId,
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
  } = useCrawlComments(crawlId, currentUserId)

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
      likersFetcher={fetchCrawlCommentLikers}
      reactorsFetcher={fetchCrawlCommentReactors}
    />
  )
}
