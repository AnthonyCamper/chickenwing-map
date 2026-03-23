import { useState, useMemo, useEffect } from 'react'
import StarRating from './ui/StarRating'
import ReviewCard from './ReviewCard'
import PhotoGallery from './ui/PhotoGallery'
import PhotoModal from './gallery/PhotoModal'
import { usePhotoDetail, fetchCommentCounts } from '../hooks/usePhotoDetail'
import type { SpotWithReviews, Review, ReviewPhoto, ReviewUpdateData } from '../lib/types'

type SortKey = 'name' | 'rating'

interface Props {
  shops: SpotWithReviews[]
  loading: boolean
  error: string | null
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
}

export default function ListView({ shops, loading, error, currentUserId, isAdmin, onUpdate, onDelete }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [filterReviewer, setFilterReviewer] = useState<string>('all')
  const [expandedSpot, setExpandedSpot] = useState<string | null>(null)

  const photoDetail = usePhotoDetail(currentUserId)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})

  // Fetch comment counts for all photos
  useEffect(() => {
    const allPhotoIds = shops.flatMap(s => s.photos.map(p => p.id))
    if (allPhotoIds.length > 0) {
      fetchCommentCounts(allPhotoIds).then(setCommentCounts)
    }
  }, [shops])

  // Collect all unique reviewers
  const reviewers = useMemo(() => {
    const set = new Map<string, string>()
    for (const { reviews } of shops) {
      for (const r of reviews) {
        const key = r.user_id
        if (!set.has(key)) {
          set.set(key, r.reviewer_name ?? r.reviewer_email ?? 'Unknown')
        }
      }
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }))
  }, [shops])

  const sorted = useMemo(() => {
    const filtered = filterReviewer === 'all'
      ? shops
      : shops
          .map(s => ({
            ...s,
            reviews: s.reviews.filter(r => r.user_id === filterReviewer),
          }))
          .filter(s => s.reviews.length > 0)

    return [...filtered].sort((a, b) => {
      if (sortBy === 'rating') return b.avg_rating - a.avg_rating
      return a.spot.name.localeCompare(b.spot.name)
    })
  }, [shops, sortBy, filterReviewer])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-charcoal-400 text-sm">{error}</p>
      </div>
    )
  }

  const shopsWithReviews = sorted.filter(s => s.reviews.length > 0)

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24">
        {/* Controls */}
        {shopsWithReviews.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* Sort */}
            <div className="flex items-center bg-warmgray-100 rounded-xl p-1 border border-warmgray-200 text-xs">
              {([['name', 'Name'], ['rating', '🍗 Rating']] as [SortKey, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-all duration-150 ${
                    sortBy === key ? 'bg-white text-charcoal-700 shadow-soft' : 'text-charcoal-400 hover:text-charcoal-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Reviewer filter */}
            {reviewers.length > 1 && (
              <select
                value={filterReviewer}
                onChange={e => setFilterReviewer(e.target.value)}
                className="text-xs rounded-xl border border-warmgray-200 bg-warmgray-100 px-3 py-2 text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <option value="all">All reviewers</option>
                {reviewers.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Shop cards */}
        {shopsWithReviews.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {shopsWithReviews.map(({ spot, reviews, avg_rating, photos }) => (
              <SpotCard
                key={spot.id}
                spotId={spot.id}
                name={spot.name}
                address={spot.address}
                reviews={reviews}
                avgRating={avg_rating}
                photos={photos}
                expanded={expandedSpot === spot.id}
                onToggle={() => setExpandedSpot(expandedSpot === spot.id ? null : spot.id)}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onPhotoOpen={photoDetail.open}
                commentCounts={commentCounts}
              />
            ))}
          </div>
        )}
      </div>

      {/* Photo detail loading overlay */}
      {photoDetail.loading && (
        <div className="fixed inset-0 z-[140] bg-black/40 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
        </div>
      )}

      {/* Photo detail modal */}
      {photoDetail.photo && (
        <PhotoModal
          photo={photoDetail.photo}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={photoDetail.close}
          onLike={photoDetail.toggleLike}
          onCommentAdded={photoDetail.onCommentAdded}
        />
      )}
    </>
  )
}

interface SpotCardProps {
  spotId: string
  name: string
  address: string
  reviews: Review[]
  avgRating: number
  photos: ReviewPhoto[]
  expanded: boolean
  onToggle: () => void
  currentUserId: string
  isAdmin: boolean
  onUpdate: Props['onUpdate']
  onDelete: Props['onDelete']
  onPhotoOpen: (photoId: string) => void
  commentCounts: Record<string, number>
}

function SpotCard({
  name, address, reviews, avgRating, photos,
  expanded, onToggle, currentUserId, isAdmin, onUpdate, onDelete,
  onPhotoOpen, commentCounts,
}: SpotCardProps) {
  return (
    <div className="card animate-slide-up">
      {/* Shop header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 hover:bg-warmgray-50/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-semibold text-charcoal-800 leading-snug">
            {name}
          </h3>
          <p className="text-xs text-charcoal-400 mt-0.5 truncate">{address}</p>

          {/* Rating summary */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {reviews.length > 1 && (
              <span className="text-xs text-charcoal-300 font-medium">avg of {reviews.length}</span>
            )}
            <span className="rating-wing">
              🍗 <StarRating value={avgRating} size="sm" />
              <span className="ml-0.5">{avgRating.toFixed(1)}</span>
            </span>
          </div>
        </div>

        {/* Cover photo thumbnail or reviewer avatars */}
        <div className="flex-shrink-0 mt-1">
          {photos.length > 0 ? (
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-warmgray-100">
              <img
                src={photos[0].url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex -space-x-1.5">
              {reviews.slice(0, 3).map((r, i) => (
                <div
                  key={r.id}
                  className="w-6 h-6 rounded-full overflow-hidden ring-2 ring-white bg-warmgray-200 flex items-center justify-center"
                  style={{ zIndex: 3 - i }}
                >
                  {r.reviewer_avatar ? (
                    <img src={r.reviewer_avatar} alt={r.reviewer_name ?? ''} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-charcoal-500">
                      {(r.reviewer_name ?? r.reviewer_email ?? '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
              {reviews.length > 3 && (
                <div className="w-6 h-6 rounded-full ring-2 ring-white bg-warmgray-300 flex items-center justify-center">
                  <span className="text-xs text-charcoal-500 font-semibold">+{reviews.length - 3}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-warmgray-100">
          {/* Photo gallery */}
          {photos.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <PhotoGallery
                photos={photos}
                onPhotoOpen={onPhotoOpen}
                commentCounts={commentCounts}
              />
            </div>
          )}

          {/* Reviews */}
          <div className="px-5 divide-y divide-warmgray-100">
            {reviews.map(review => (
              <ReviewCard
                key={review.id}
                review={review}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">🍗</div>
      <h3 className="font-display text-lg text-charcoal-700 mb-2">No reviews yet</h3>
      <p className="text-sm text-charcoal-400 max-w-xs leading-relaxed">
        Tap the + button to add your first wing spot review.
      </p>
    </div>
  )
}
