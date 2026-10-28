import { useState } from 'react'
import Modal from './ui/Modal'
import RatingPicker from './ui/RatingPicker'
import PhotoUpload from './ui/PhotoUpload'
import WingFlavorPicker from './ui/WingFlavorPicker'
import { localDateString } from '../lib/dates'
import { holdBadgeAnnouncements } from '../lib/badgeUnlocks'
import {
  MIN_VISIT_DATE,
  ReviewTextCounter,
  errorSummary,
  focusField,
  reviewTextProblem,
  visitDateProblem,
} from './ReviewFormModal'
import type { Review, ReviewPhoto, ReviewUpdateData } from '../lib/types'

interface Props {
  review: Review
  onClose: () => void
  onSubmit: (data: ReviewUpdateData) => Promise<void>
}

export default function ReviewEditModal({ review, onClose, onSubmit }: Props) {
  const [overallRating, setOverallRating] = useState<number>(Number(review.overall_rating) || 5)
  const [wingSize, setWingSize] = useState(review.wing_size ?? '')
  const [wingFlavor, setWingFlavor] = useState(review.wing_flavor ?? '')
  const [isTakeout, setIsTakeout] = useState(review.is_takeout ?? false)
  const [takeoutContainer, setTakeoutContainer] = useState(review.takeout_container ?? '')
  const [reviewText, setReviewText] = useState(review.review_text ?? '')
  const [visitedAt, setVisitedAt] = useState(
    review.visited_at ? review.visited_at.split('T')[0] : localDateString()
  )
  // Local date, not toISOString() — see lib/dates.
  const [today] = useState(() => localDateString())

  // Photo editing state — `deletedPhotoIds` is the ground truth for what will
  // be removed on save; UI marks photos with `pendingRemoval` so the user can
  // undo before committing.
  const initialPhotos = review.photos ?? []
  const [existingPhotos] = useState<ReviewPhoto[]>(initialPhotos)
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const summary = errorSummary({
    ...(textError ? { reviewText: textError } : {}),
    ...(dateError ? { visitedAt: dateError } : {}),
  })

  const remainingExisting = existingPhotos.filter(p => !deletedPhotoIds.includes(p.id))
  const totalPhotos = remainingExisting.length + newPhotos.length
  const remainingSlots = Math.max(0, 5 - totalPhotos)

  const markForRemoval = (photoId: string) =>
    setDeletedPhotoIds(prev => prev.includes(photoId) ? prev : [...prev, photoId])
  const undoRemoval = (photoId: string) =>
    setDeletedPhotoIds(prev => prev.filter(id => id !== photoId))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const textProblem = reviewTextProblem(reviewText)
    const dateProblem = visitDateProblem(visitedAt, today)
    setTextError(textProblem)
    setDateError(dateProblem)
    // Bring the first problem into view and focus it (m1 breaker 1).
    if (textProblem || dateProblem) {
      requestAnimationFrame(() => focusField(textProblem ? 'edit-review-text' : 'edit-visited'))
      return
    }
    setSubmitting(true)
    // Any badge this edit unlocks shows after the sheet has closed, not over
    // a "Saving…" button.
    const releaseBadges = holdBadgeAnnouncements()
    try {
      await onSubmit({
        overall_rating: overallRating > 0 ? overallRating : 5,
        wing_size: wingSize || undefined,
        wing_flavor: wingFlavor || undefined,
        is_takeout: isTakeout,
        takeout_container: isTakeout ? takeoutContainer || undefined : '',
        review_text: reviewText || undefined,
        visited_at: visitedAt,
        photos_to_delete: deletedPhotoIds,
        new_photos: newPhotos,
      })
    } finally {
      setSubmitting(false)
      setTimeout(() => releaseBadges(), 600)
    }
  }

  return (
    <Modal
      title="Edit your review"
      // Closing mid-save would leave the user unsure whether it was saved.
      onClose={() => { if (!submitting) onClose() }}
      size="md"
      footer={
        <div className="space-y-2">
          {summary && (
            <p className="text-xs font-bold text-red-600 text-center" role="status">{summary}</p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} disabled={submitting} className="btn-secondary px-5">
              Cancel
            </button>
            <button type="submit" form="review-edit-form" disabled={submitting} className="btn-primary flex-1 whitespace-nowrap">
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      }
    >
      <form id="review-edit-form" onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-5">
        <RatingPicker
          value={overallRating}
          onChange={setOverallRating}
          accent="amber"
          icon="🍗"
          label="Wing rating"
        />


        <div>
          <label className="label" htmlFor="edit-wing-size">Wing size (optional)</label>
          <select
            id="edit-wing-size"
            className="input"
            value={wingSize}
            onChange={e => setWingSize(e.target.value)}
          >
            <option value="">Choose a size…</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="jumbo">Jumbo</option>
          </select>
        </div>

        <div>
          <label className="label">Flavor (optional)</label>
          <WingFlavorPicker value={wingFlavor} onChange={setWingFlavor} />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px]">
            <input
              type="checkbox"
              checked={isTakeout}
              onChange={e => { setIsTakeout(e.target.checked); if (!e.target.checked) setTakeoutContainer('') }}
              className="sr-only"
            />
            <div className={`relative w-11 h-6 rounded-full transition-colors duration-150 ${isTakeout ? 'bg-sauce-400' : 'bg-night-900/20'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-150 ${isTakeout ? 'translate-x-[22px]' : 'translate-x-0'}`} />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-600">Takeout</span>
            <span className="text-xs text-charcoal-500">I ordered the food to go</span>
          </label>
        </div>

        {isTakeout && (
          <div>
            <label className="label" htmlFor="edit-takeout-container">Takeout container (optional)</label>
            <select
              id="edit-takeout-container"
              className="input"
              value={takeoutContainer}
              onChange={e => setTakeoutContainer(e.target.value)}
            >
              <option value="">Choose a container…</option>
              <option value="styrofoam">Styrofoam</option>
              <option value="cardboard">Cardboard</option>
              <option value="plastic">Plastic</option>
              <option value="aluminum">Aluminum</option>
              <option value="bag_only">Bag only</option>
              <option value="other">Other</option>
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="edit-review-text">Your review (optional)</label>
          {/* No maxLength: it silently cut pasted text; see ReviewFormModal. */}
          <textarea
            id="edit-review-text"
            className="input resize-none"
            rows={4}
            value={reviewText}
            onChange={e => {
              setReviewText(e.target.value)
              if (!reviewTextProblem(e.target.value)) setTextError(null)
            }}
            placeholder="What did you think of the wings?"
            aria-invalid={!!textError || undefined}
            aria-describedby="edit-review-text-count edit-review-text-error"
          />
          <ReviewTextCounter length={reviewText.length} id="edit-review-text-count" />
          {textError && (
            <p id="edit-review-text-error" className="text-xs text-red-600 mt-1" role="alert">{textError}</p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="edit-visited">Date you visited</label>
          <input
            id="edit-visited"
            type="date"
            className="input"
            value={visitedAt}
            onChange={e => {
              setVisitedAt(e.target.value)
              setDateError(visitDateProblem(e.target.value, today, { typing: true }))
            }}
            onBlur={e => setDateError(visitDateProblem(e.target.value, today))}
            min={MIN_VISIT_DATE}
            max={today}
            required
            aria-invalid={!!dateError || undefined}
            aria-describedby={dateError ? 'edit-visited-error' : undefined}
          />
          {dateError && (
            <p id="edit-visited-error" className="text-xs text-red-600 mt-1" role="alert">{dateError}</p>
          )}
        </div>

        {/* Photos */}
        <div>
          <label className="label">Photos</label>

          {/* Existing photos */}
          {existingPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {existingPhotos.map(photo => {
                const removed = deletedPhotoIds.includes(photo.id)
                return (
                  <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-warmgray-100 group">
                    <img
                      src={photo.url}
                      alt="Review photo"
                      className={`w-full h-full object-cover transition-all ${removed ? 'opacity-30 grayscale' : ''}`}
                    />
                    {removed ? (
                      <button
                        type="button"
                        onClick={() => undoRemoval(photo.id)}
                        className="absolute inset-0 flex items-center justify-center bg-night-900/55 text-cream-50 text-[11px] font-extrabold uppercase tracking-crowd hover:bg-night-900/65 transition-colors"
                        aria-label="Undo remove photo"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markForRemoval(photo.id)}
                        className="absolute top-1 right-1 w-10 h-10 rounded-full bg-night-900/75 hover:bg-night-900 text-cream-50 text-base flex items-center justify-center shadow-sm transition-colors"
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Add new photos (only if slots remain) */}
          {(remainingSlots > 0 || newPhotos.length > 0) && (
            <PhotoUpload
              files={newPhotos}
              onChange={setNewPhotos}
              max={newPhotos.length + remainingSlots}
              perReview={5}
            />
          )}

          {remainingSlots === 0 && totalPhotos >= 5 && newPhotos.length === 0 && (
            <p className="text-xs text-charcoal-400 mt-1">
              You can have up to 5 photos. Remove one to add another.
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
