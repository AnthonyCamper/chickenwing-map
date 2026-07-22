import { useState } from 'react'
import StarRating from './ui/StarRating'
import ReviewCard from './ReviewCard'
import ReviewPhotoFan, { groupPhotosByReview } from './ui/ReviewPhotoFan'
import type { SpotWithReviews, Review, ReviewPhoto, ReviewUpdateData } from '../lib/types'

interface ShopPanelProps {
  spotData: SpotWithReviews
  onClose: () => void
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  onPhotoOpen: (photoId: string) => void
}

export default function ShopPanel({ spotData, onClose, currentUserId, isAdmin, onUpdate, onDelete, onPhotoOpen }: ShopPanelProps) {
  const { spot, reviews, avg_rating, photos } = spotData
  // Collapsed on every open; MapView keys this component by spot id so
  // selecting another spot resets it.
  const [showReviews, setShowReviews] = useState(false)

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="absolute inset-0 z-20 sm:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-30 sm:left-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-80 bg-cream-50 rounded-t-3xl sm:rounded-3xl sm:border-2 sm:border-night-900 shadow-elevated animate-slide-up max-h-[72dvh] sm:max-h-[calc(100dvh-120px)] flex flex-col">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-night-900/25" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-night-900/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display uppercase tracking-wide text-base text-night-900 leading-snug truncate">
              {spot.name}
            </h3>
            <p className="text-xs text-charcoal-500 mt-0.5 truncate">{spot.address}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {reviews.length > 1 && (
                <span className="text-xs text-charcoal-400">avg of {reviews.length}</span>
              )}
              <span className="rating-wing">
                🍗 <StarRating value={avg_rating} size="sm" />
                <span className="ml-0.5">{avg_rating.toFixed(1)}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-charcoal-500 hover:bg-cream-100 hover:text-night-900 transition-colors text-2xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="overflow-y-auto flex-1 overscroll-contain"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Photo strip — one fan per review */}
          {photos.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <PhotoStrip photos={photos} onPhotoOpen={onPhotoOpen} />
            </div>
          )}

          {/* Reviews — collapsed behind a toggle */}
          {reviews.length > 0 && (
            <div className="px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowReviews(v => !v)}
                aria-expanded={showReviews}
                className="w-full mt-2 py-2.5 rounded-xl border-2 border-night-900 bg-cream-100 hover:bg-cream-200 transition-colors text-xs font-extrabold uppercase tracking-crowd text-night-900"
              >
                {showReviews
                  ? '▴ Hide reviews'
                  : `▾ Show ${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
              </button>
              {showReviews && (
                <div className="divide-y divide-night-900/10">
                  {reviews.map((review: Review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

interface PhotoStripProps {
  photos: ReviewPhoto[]
  onPhotoOpen: (photoId: string) => void
}

function PhotoStrip({ photos, onPhotoOpen }: PhotoStripProps) {
  const groups = groupPhotosByReview(photos)
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {groups.map(group => (
        <ReviewPhotoFan
          key={group[0].id}
          photos={group}
          onOpen={() => onPhotoOpen(group[0].id)}
        />
      ))}
    </div>
  )
}
