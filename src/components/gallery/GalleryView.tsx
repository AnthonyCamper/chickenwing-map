import { useEffect, useRef, useState } from 'react'
import { useGallery } from '../../hooks/useGallery'
import { useHistoryModal } from '../../hooks/useHistoryModal'
import { useAuthGate } from '../AuthGateModal'
import ReviewCard from './ReviewCard'
import PhotoModal from './PhotoModal'
import type { GalleryReviewItem } from '../../lib/types'

interface Props {
  currentUserId: string
  isAdmin: boolean
  onViewOnMap?: (spotId: string) => void
}

export default function GalleryView({ currentUserId, isAdmin, onViewOnMap }: Props) {
  const gallery = useGallery(currentUserId)
  const { requireAuth } = useAuthGate()
  const [selectedReview, setSelectedReview] = useState<GalleryReviewItem | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Browser back / swipe-back closes the photo modal
  useHistoryModal(!!selectedReview, () => setSelectedReview(null))

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) gallery.loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [gallery.loadMore]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep modal review data in sync with optimistic like updates
  const syncedReview = selectedReview
    ? (gallery.reviews.find(r => r.review_id === selectedReview.review_id) ?? selectedReview)
    : null

  if (gallery.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
      </div>
    )
  }

  if (gallery.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-charcoal-400 text-sm">{gallery.error}</p>
      </div>
    )
  }

  if (gallery.reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="text-5xl mb-4">📷</div>
        <h3 className="font-display text-lg text-charcoal-700 mb-2">No photos yet</h3>
        <p className="text-sm text-charcoal-400 max-w-xs leading-relaxed">
          Upload photos when you add a review — they'll appear here.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-4 pb-safe-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold text-charcoal-700">
            {gallery.reviews.length} {gallery.reviews.length === 1 ? 'review' : 'reviews'}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {gallery.reviews.map(review => (
            <ReviewCard
              key={review.review_id}
              review={review}
              onOpen={() => setSelectedReview(review)}
              onLike={() => { if (requireAuth()) gallery.toggleLike(review.review_id) }}
            />
          ))}
        </div>

        {gallery.hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {gallery.loadingMore && (
              <div className="w-6 h-6 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
            )}
          </div>
        )}

        {!gallery.hasMore && gallery.reviews.length > 0 && (
          <p className="text-center text-xs text-charcoal-300 py-6">All caught up 🍗</p>
        )}
      </div>

      {syncedReview && (
        <PhotoModal
          review={syncedReview}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setSelectedReview(null)}
          onLike={() => { if (requireAuth()) gallery.toggleLike(syncedReview.review_id) }}
          onCommentAdded={() => gallery.refreshReview(syncedReview.review_id)}
          onViewOnMap={onViewOnMap ? (spotId) => { setSelectedReview(null); onViewOnMap(spotId) } : undefined}
        />
      )}
    </>
  )
}
