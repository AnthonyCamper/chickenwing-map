import { useState } from 'react'
import Modal from './ui/Modal'
import RatingPicker from './ui/RatingPicker'
import PhotoUpload from './ui/PhotoUpload'
import type { Review, ReviewPhoto, ReviewUpdateData } from '../lib/types'

interface Props {
  review: Review
  onClose: () => void
  onSubmit: (data: ReviewUpdateData) => Promise<void>
}

export default function ReviewEditModal({ review, onClose, onSubmit }: Props) {
  const [overallRating, setOverallRating] = useState(review.overall_rating)
  const [wingSize, setWingSize] = useState(review.wing_size ?? '')
  const [wingFlavor, setWingFlavor] = useState(review.wing_flavor ?? '')
  const [isTakeout, setIsTakeout] = useState(review.is_takeout ?? false)
  const [takeoutContainer, setTakeoutContainer] = useState(review.takeout_container ?? '')
  const [reviewText, setReviewText] = useState(review.review_text ?? '')
  const [visitedAt, setVisitedAt] = useState(review.visited_at.split('T')[0])

  // Photo editing state
  const [existingPhotos, setExistingPhotos] = useState<ReviewPhoto[]>(review.photos ?? [])
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([])
  const [newPhotos, setNewPhotos] = useState<File[]>([])

  const [submitting, setSubmitting] = useState(false)

  const totalPhotos = existingPhotos.length + newPhotos.length
  const remainingSlots = Math.max(0, 5 - totalPhotos)

  const removeExisting = (photoId: string) => {
    setExistingPhotos(prev => prev.filter(p => p.id !== photoId))
    setDeletedPhotoIds(prev => [...prev, photoId])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit({
      overall_rating: overallRating,
      wing_size: wingSize || undefined,
      wing_flavor: wingFlavor || undefined,
      is_takeout: isTakeout,
      takeout_container: isTakeout ? takeoutContainer || undefined : undefined,
      review_text: reviewText || undefined,
      visited_at: visitedAt,
      photos_to_delete: deletedPhotoIds,
      new_photos: newPhotos,
    })
    setSubmitting(false)
  }

  return (
    <Modal title="Edit Review" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
        <RatingPicker
          value={overallRating}
          onChange={setOverallRating}
          accent="amber"
          icon="🍗"
          label="Wing Rating"
        />


        <div>
          <label className="label" htmlFor="edit-wing-size">Wing Size (optional)</label>
          <select
            id="edit-wing-size"
            className="input"
            value={wingSize}
            onChange={e => setWingSize(e.target.value)}
          >
            <option value="">Select size…</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
            <option value="jumbo">Jumbo</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="edit-wing-flavor">Wing Flavor (optional)</label>
          <input
            id="edit-wing-flavor"
            type="text"
            className="input"
            maxLength={60}
            value={wingFlavor}
            onChange={e => setWingFlavor(e.target.value)}
            placeholder="Buffalo Hot, Lemon Pepper, Garlic Parmesan…"
            list="edit-wing-flavor-options"
          />
          <datalist id="edit-wing-flavor-options">
            {[
              "Buffalo Hot", "Buffalo Medium", "Buffalo Mild", "Honey BBQ", "BBQ", "Spicy BBQ",
              "Carolina Gold BBQ", "Nashville Hot", "Garlic Parmesan", "Lemon Pepper", "Teriyaki",
              "Mango Habanero", "Thai Chili", "Sriracha", "Ghost Pepper", "Korean BBQ",
              "Caribbean Jerk", "Bourbon", "Chipotle BBQ", "Old Bay", "Honey Old Bay",
              "Honey Mustard", "Sweet Chili", "Ranch Dry Rub", "Cajun Dry Rub", "Memphis Dry Rub",
              "Salt & Vinegar", "Smoked", "Plain/Naked", "Elote", "Dry Rub", "Spicy Garlic",
              "Honey Garlic", "Peanut Butter Jelly", "Maple Bacon", "Truffle Parmesan",
              "Szechuan", "Hoisin", "Mumbo Sauce", "Alabama White Sauce",
            ].map(f => <option key={f} value={f} />)}
          </datalist>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isTakeout}
              onChange={e => { setIsTakeout(e.target.checked); if (!e.target.checked) setTakeoutContainer('') }}
              className="sr-only"
            />
            <div className={`relative w-9 h-5 rounded-full transition-colors duration-150 ${isTakeout ? 'bg-amber-400' : 'bg-warmgray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150 ${isTakeout ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-charcoal-400">Takeout</span>
          </label>
        </div>

        {isTakeout && (
          <div>
            <label className="label" htmlFor="edit-takeout-container">Container Type (optional)</label>
            <select
              id="edit-takeout-container"
              className="input"
              value={takeoutContainer}
              onChange={e => setTakeoutContainer(e.target.value)}
            >
              <option value="">Select container…</option>
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
          <label className="label" htmlFor="edit-review-text">Review (optional)</label>
          <textarea
            id="edit-review-text"
            className="input resize-none"
            rows={4}
            maxLength={500}
            value={reviewText}
            onChange={e => setReviewText(e.target.value)}
            placeholder="Tell us about the wings..."
          />
        </div>

        <div>
          <label className="label" htmlFor="edit-visited">Date Visited</label>
          <input
            id="edit-visited"
            type="date"
            className="input"
            value={visitedAt}
            onChange={e => setVisitedAt(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        {/* Photos */}
        <div>
          <label className="label">Photos</label>

          {/* Existing photos */}
          {existingPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {existingPhotos.map(photo => (
                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-warmgray-100 group">
                  <img
                    src={photo.url}
                    alt="Review photo"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExisting(photo.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new photos (only if slots remain) */}
          {remainingSlots > 0 && (
            <PhotoUpload
              files={newPhotos}
              onChange={setNewPhotos}
              max={remainingSlots}
            />
          )}

          {remainingSlots === 0 && totalPhotos >= 5 && (
            <p className="text-xs text-charcoal-400 mt-1">
              Maximum 5 photos reached. Remove an existing photo to add a new one.
            </p>
          )}
        </div>

        <div className="flex gap-3 pb-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
