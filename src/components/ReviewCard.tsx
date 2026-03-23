import { useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import StarRating from './ui/StarRating'
import ReviewEditModal from './ReviewEditModal'
import type { Review, ReviewUpdateData } from '../lib/types'

interface Props {
  review: Review
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  compact?: boolean
}

export default function ReviewCard({
  review,
  currentUserId,
  isAdmin,
  onUpdate,
  onDelete,
  compact = false,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
        {/* Rating row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="rating-wing">
            🍗 <StarRating value={review.overall_rating} size="sm" /> {Number(review.overall_rating).toFixed(1)}/10
          </span>
          {review.wing_size && (
            <span className="text-xs text-charcoal-400 font-medium capitalize">{review.wing_size}</span>
          )}
          {review.is_takeout && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Takeout</span>
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
          <p className="text-sm text-charcoal-600 leading-relaxed mb-1.5 italic">
            "{review.review_text}"
          </p>
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
