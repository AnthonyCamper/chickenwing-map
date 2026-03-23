import { useState } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import StarRating from './ui/StarRating'
import ReviewEditModal from './ReviewEditModal'
import type { Review, ReviewUpdateData } from '../lib/types'

// ─── Legacy detail ratings for migrated reviews ──────────────────────────────

const RATING_LABELS: Record<string, string> = {
  appearance_rating: 'Appearance',
  aroma_rating: 'Aroma',
  sauce_quantity_rating: 'Sauce Qty',
  sauce_consistency_rating: 'Sauce Consistency',
  sauce_heat_rating: 'Sauce Heat',
  skin_consistency_rating: 'Skin Crispiness',
  meat_quality_rating: 'Meat Quality',
  greasiness_rating: 'Greasiness',
  blue_cheese_quality_rating: 'Blue Cheese',
  satisfaction_score: 'Satisfaction',
  recommendation_score: 'Recommendation',
}

const FORMAT_LABELS: Record<string, string> = {
  Fried: 'Fried',
  Smoked: 'Smoked',
  Grilled: 'Grilled',
  'Smoked then Fried': 'Smoked then Fried',
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, (Number(value) / 10) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-charcoal-500 w-28 shrink-0 text-right">{label}</span>
      <div className="flex-1 bg-warmgray-200 rounded-full h-1.5">
        <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-charcoal-400 w-6 text-right font-medium">{value}</span>
    </div>
  )
}

function LegacyDetails({ data }: { data: Record<string, unknown> }) {
  const [open, setOpen] = useState(false)

  const filteredRatings = Object.entries(RATING_LABELS)
    .filter(([key]) => !(key === 'blue_cheese_quality_rating' && data.blue_cheese_na))
    .map(([key, label]) => ({ label, value: data[key] as number }))
    .filter(r => r.value != null)

  const wingFormat = data.wing_format as string | null
  const wingsPerOrder = data.wings_per_order as number | null
  const beerInfluence = data.beer_influence as boolean | null
  const takeoutWait = data.takeout_wait_time as number | null
  const moodComparison = data.mood_comparison as number | null

  const hasDetails = filteredRatings.length > 0 || wingFormat || wingsPerOrder

  if (!hasDetails) return null

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-charcoal-300 hover:text-charcoal-500 transition-colors flex items-center gap-1"
      >
        <span className="transform transition-transform" style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
        Legacy Details
      </button>
      {open && (
        <div className="mt-2 bg-warmgray-50 rounded-xl px-4 py-3 space-y-3 animate-fade-in">
          {/* Quick stats row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {wingFormat && FORMAT_LABELS[wingFormat] && (
              <span className="text-xs text-charcoal-500"><span className="text-charcoal-300">Format:</span> {wingFormat}</span>
            )}
            {wingFormat && !FORMAT_LABELS[wingFormat] && (
              <span className="text-xs text-charcoal-500"><span className="text-charcoal-300">Sauces available:</span> {wingFormat}</span>
            )}
            {wingsPerOrder != null && (
              <span className="text-xs text-charcoal-500"><span className="text-charcoal-300">Wings/order:</span> {wingsPerOrder}</span>
            )}
            {beerInfluence && (
              <span className="text-xs text-charcoal-500">🍺 Beer influenced</span>
            )}
            {takeoutWait != null && takeoutWait > 0 && (
              <span className="text-xs text-charcoal-500"><span className="text-charcoal-300">Wait:</span> {takeoutWait}min</span>
            )}
            {moodComparison != null && (
              <span className="text-xs text-charcoal-500">
                <span className="text-charcoal-300">Mood:</span>{' '}
                {moodComparison <= 2 ? '😞' : moodComparison <= 4 ? '😐' : moodComparison <= 6 ? '🙂' : moodComparison <= 8 ? '😊' : '🤩'} {moodComparison}/10
              </span>
            )}
          </div>

          {/* Rating bars */}
          {filteredRatings.length > 0 && (
            <div className="space-y-1.5">
              {filteredRatings.map(r => (
                <RatingBar key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

        {/* Legacy details (migrated reviews) */}
        {review.legacy_data && <LegacyDetails data={review.legacy_data} />}

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
