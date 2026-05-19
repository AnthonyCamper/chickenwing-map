import { useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import StarRating from './ui/StarRating'
import ExpandableText from './ui/ExpandableText'
import ReviewEditModal from './ReviewEditModal'
import ReactionPicker from './gallery/ReactionPicker'
import LikedByOverlay from './gallery/LikedByOverlay'
import { useReviewReactions } from '../hooks/useReviewReactions'
import { useAuthGate } from './AuthGateModal'
import { fetchReviewReactors } from '../lib/reactionDetails'
import type { Review, ReviewUpdateData } from '../lib/types'

interface Props {
  review: Review
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  compact?: boolean
  commentCount?: number
}

export default function ReviewCard({
  review,
  currentUserId,
  isAdmin,
  onUpdate,
  onDelete,
  compact = false,
  commentCount = 0,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const localCommentCount = commentCount

  const { requireAuth } = useAuthGate()
  const { reactions, toggleReaction } = useReviewReactions(review.id, currentUserId)
  const totalReactionCount = reactions.reduce((sum, r) => sum + r.count, 0)

  const canEdit = isAdmin || review.user_id === currentUserId
  const visitedDate = (() => {
    try { return format(new Date(review.visited_at), 'MMM d, yyyy') }
    catch { return review.visited_at }
  })()

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await onDelete(review.id)
    if (error) {
      toast.error('Could not delete review')
      setDeleting(false)
      setConfirmDelete(false)
    } else {
      toast.success('Review deleted')
    }
  }

  return (
    <>
      <div id={`review-${review.id}`} className={`${compact ? 'py-3' : 'py-4'} animate-fade-in transition-shadow duration-300`}>
        {/* Ratings row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="rating-wing">
            🍗 <StarRating value={review.overall_rating} size="sm" /> {review.overall_rating.toFixed(1)}
          </span>
          {review.event_id && review.event_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase tracking-wide">
              🏆 {review.event_name}
            </span>
          )}
        </div>

        {/* Wing flavor */}
        {review.wing_flavor && (
          <p className="text-xs text-charcoal-500 mb-1.5 font-medium">
            🍗 {review.wing_flavor}
          </p>
        )}

        {/* Review text */}
        {review.review_text && (
          <ExpandableText text={review.review_text} className="mb-1.5" />
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {review.reviewer_avatar ? (
            <img
              src={review.reviewer_avatar}
              alt={review.reviewer_name ?? ''}
              className="w-4 h-4 rounded-full object-cover"
            />
          ) : null}
          <span className="text-xs text-charcoal-400 font-medium">
            {review.reviewer_name ?? review.reviewer_email ?? 'Unknown'}
          </span>
          <span className="text-charcoal-200 text-xs">·</span>
          <span className="text-xs text-charcoal-300">{visitedDate}</span>

          {/* Comment toggle */}
          <span className="text-charcoal-200 text-xs">·</span>
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 text-xs text-charcoal-400 hover:text-charcoal-600 font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {localCommentCount > 0 ? localCommentCount : 'Comment'}
          </button>

          {canEdit && (
            <>
              <span className="text-charcoal-200 text-xs">·</span>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-amber-400 hover:text-amber-500 font-medium transition-colors"
              >
                Edit
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-charcoal-300 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              ) : (
                <span className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs text-charcoal-300 hover:text-charcoal-500 transition-colors"
                  >
                    Cancel
                  </button>
                </span>
              )}
            </>
          )}
        </div>

        {/* Reactions */}
        <div className="mt-2 group">
          <LikedByOverlay fetchUsers={() => fetchReviewReactors(review.id)} count={totalReactionCount} label="Reactions">
            <ReactionPicker
              reactions={reactions}
              onToggle={type => { if (requireAuth()) toggleReaction(type) }}
            />
          </LikedByOverlay>
        </div>

        {/* Comment thread placeholder — comments are per-photo in this app */}
        {showComments && (
          <div className="mt-3 -mx-1 border-t border-warmgray-100 pt-2 px-2">
            <p className="text-xs text-charcoal-400 py-2">View photos to see and leave comments.</p>
          </div>
        )}
      </div>

      {editing && (
        <ReviewEditModal
          review={review}
          onClose={() => setEditing(false)}
          onSubmit={async (data) => {
            const result = await onUpdate(review.id, data)
            if (!result.error) {
              setEditing(false)
              toast.success('Review updated')
            } else {
              toast.error(result.error)
            }
          }}
        />
      )}
    </>
  )
}
