import { useEffect, useRef, useState } from 'react'
import { useGallery } from '../../hooks/useGallery'
import { useHistoryModal } from '../../hooks/useHistoryModal'
import { useAuthGate } from '../AuthGateModal'
import ReviewCard from './ReviewCard'
import PhotoModal from './PhotoModal'
import PeopleView from './PeopleView'
import type { GalleryReviewItem } from '../../lib/types'

type Feed = 'all' | 'following' | 'people'

interface Props {
  currentUserId: string
  isAdmin: boolean
  onViewOnMap?: (spotId: string) => void
}

export default function GalleryView({ currentUserId, isAdmin, onViewOnMap }: Props) {
  const [feed, setFeed] = useState<Feed>('all')
  const gallery = useGallery(currentUserId, feed === 'following' ? true : false)
  const { requireAuth } = useAuthGate()
  const [selectedReview, setSelectedReview] = useState<GalleryReviewItem | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

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

  const syncedReview = selectedReview
    ? (gallery.reviews.find(r => r.review_id === selectedReview.review_id) ?? selectedReview)
    : null

  return (
    <>
      {/* Feed tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1.5 mb-4">
          {([['all', 'All'], ['following', 'Following'], ['people', 'People']] as [Feed, string][]).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFeed(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-crowd border-2 transition-all ${
                feed === f
                  ? 'bg-night-900 border-night-900 text-cream-50'
                  : 'border-night-900/20 text-charcoal-500 hover:border-night-900/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {feed === 'people' ? (
        <PeopleView currentUserId={currentUserId} />
      ) : gallery.loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
        </div>
      ) : gallery.error ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-charcoal-400 text-sm">{gallery.error}</p>
        </div>
      ) : gallery.reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          {feed === 'following' ? (
            <>
              <div className="text-5xl mb-4">👥</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">Nobody to follow yet</h3>
              <p className="text-sm text-charcoal-400 max-w-xs leading-relaxed mb-5">
                Follow people to see their reviews here.
              </p>
              <button
                onClick={() => setFeed('people')}
                className="btn-primary px-6"
              >
                Find people
              </button>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">📷</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">No photos yet</h3>
              <p className="text-sm text-charcoal-400 max-w-xs leading-relaxed">
                Upload photos when you add a review — they'll appear here.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 pb-safe-8">
          <div className="flex items-center justify-between mb-3">
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
      )}

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
