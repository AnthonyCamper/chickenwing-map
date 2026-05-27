import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGallery } from '../../hooks/useGallery'
import { useAuthGate } from '../AuthGateModal'
import ReviewFeedCard from './ReviewFeedCard'
import PeopleView from './PeopleView'

type Feed = 'following' | 'discover' | 'people'

interface Props {
  currentUserId: string
  isAdmin: boolean
  onViewOnMap?: (spotId: string) => void
}

export default function GalleryView({ currentUserId }: Props) {
  const navigate = useNavigate()
  const [feed, setFeed] = useState<Feed>('following')
  const gallery = useGallery(currentUserId, feed === 'following' ? true : false)
  const { requireAuth } = useAuthGate()
  const sentinelRef = useRef<HTMLDivElement>(null)

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

  return (
    <>
      {/* Feed tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1.5 mb-4">
          {([['following', 'Following'], ['discover', 'Discover'], ['people', 'People']] as [Feed, string][]).map(([f, label]) => (
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
              <div className="text-5xl mb-4">🍗</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">No takes yet</h3>
              <p className="text-sm text-charcoal-400 max-w-xs leading-relaxed mb-5">
                Follow some wing heads to see their takes here. Or check out Discover to see what everyone's eating.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeed('people')}
                  className="btn-primary px-5"
                >
                  Find people
                </button>
                <button
                  onClick={() => setFeed('discover')}
                  className="btn-secondary px-5"
                >
                  Discover
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">🥁</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">Nothing here yet</h3>
              <p className="text-sm text-charcoal-400 max-w-xs leading-relaxed">
                Be the first to drop a take. The wing council is waiting.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 pb-safe-8">
          <div className="space-y-3">
            {gallery.reviews.map(review => (
              <ReviewFeedCard
                key={review.review_id}
                review={review}
                onOpen={() => navigate(`/reviews/${review.review_id}`)}
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
            <p className="text-center text-xs text-charcoal-300 py-6 uppercase tracking-crowd font-bold">
              You're all caught up 🍗
            </p>
          )}
        </div>
      )}
    </>
  )
}
