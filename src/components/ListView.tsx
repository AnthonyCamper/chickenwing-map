import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import StarRating from './ui/StarRating'
import PhotoModal from './gallery/PhotoModal'
import { usePhotoDetail } from '../hooks/usePhotoDetail'
import { useHistoryModal } from '../hooks/useHistoryModal'
import type { SpotWithReviews, Review, ReviewPhoto } from '../lib/types'

type SortKey = 'name' | 'rating'

interface Props {
  shops: SpotWithReviews[]
  loading: boolean
  error: string | null
  currentUserId: string
  isAdmin: boolean
  onViewOnMap?: (shopId: string) => void
  sortBy: SortKey
  onSortChange: (sort: SortKey) => void
  filterReviewer: string
  onFilterChange: (reviewer: string) => void
}

export default function ListView({
  shops, loading, error, currentUserId, isAdmin, onViewOnMap,
  sortBy, onSortChange: setSortBy, filterReviewer, onFilterChange: setFilterReviewer,
}: Props) {

  const photoDetail = usePhotoDetail(currentUserId)
  useHistoryModal(!!photoDetail.photo, photoDetail.close)

  const reviewers = useMemo(() => {
    const set = new Map<string, string>()
    for (const { reviews } of shops) {
      for (const r of reviews) {
        if (!set.has(r.user_id)) {
          set.set(r.user_id, r.reviewer_name ?? r.reviewer_email ?? 'Unknown')
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
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
        <p className="font-display uppercase tracking-crowd text-sm text-night-700">Loading the scoreboard…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="sticker-sauce mb-4">Scene broke</div>
        <p className="text-sm text-charcoal-500 max-w-xs">{error}</p>
      </div>
    )
  }

  const shopsWithReviews = sorted.filter(s => s.reviews.length > 0)
  const showRanks = sortBy === 'rating'

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Page heading */}
        {shopsWithReviews.length > 0 && (
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow mb-1">The scoreboard</p>
              <h2 className="font-display uppercase text-3xl sm:text-4xl text-night-900 leading-tight tracking-wide">
                {sortBy === 'rating' ? 'Who runs the streets' : 'Every spot on the board'}
              </h2>
            </div>
            <div className="sticker-night flex-shrink-0 hidden sm:inline-flex">
              {shopsWithReviews.length} {shopsWithReviews.length === 1 ? 'spot' : 'spots'}
            </div>
          </div>
        )}

        {/* Controls */}
        {shopsWithReviews.length > 0 && (
          <div className="mb-5 flex items-center gap-3 flex-wrap">
            {/* Sort toggle */}
            <div className="flex items-center gap-2">
              <span className="eyebrow text-night-700">Sort</span>
              <div className="flex items-center bg-night-900 rounded-full p-1 border-2 border-night-900 shadow-sticker-sm">
                {([['name', 'A→Z'], ['rating', 'Heat']] as [SortKey, string][]).map(([key, label]) => {
                  const active = sortBy === key
                  return (
                    <button
                      key={key}
                      onClick={() => setSortBy(key)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-crowd transition-all
                        ${active
                          ? 'bg-sauce-400 text-cream-50'
                          : 'text-cream-200/70 hover:text-cream-50'}`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Reviewer filter */}
            {reviewers.length > 1 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="eyebrow text-night-700">Who</span>
                <div className="relative">
                  <select
                    value={filterReviewer}
                    onChange={e => setFilterReviewer(e.target.value)}
                    className="appearance-none text-[11px] font-extrabold uppercase tracking-crowd
                               rounded-full border-2 border-night-900 bg-cream-50 text-night-900
                               pl-3 pr-8 py-1.5 shadow-sticker-sm
                               focus:outline-none focus:ring-2 focus:ring-sauce-400 cursor-pointer"
                  >
                    <option value="all">Everybody</option>
                    {reviewers.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-night-900 text-xs">▾</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Shop cards */}
        {shopsWithReviews.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {shopsWithReviews.map(({ spot, reviews, avg_rating, photos }, idx) => (
              <ShopCard
                key={spot.id}
                shopId={spot.id}
                slug={spot.slug}
                rank={idx + 1}
                showRank={showRanks}
                name={spot.name}
                address={spot.address}
                reviews={reviews}
                avgRating={avg_rating}
                photos={photos}
                onViewOnMap={onViewOnMap}
              />
            ))}
          </div>
        )}
      </div>

      {photoDetail.loading && (
        <div className="fixed inset-0 z-[140] bg-night-900/70 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-night-700 border-t-sauce-400 animate-spin" />
        </div>
      )}

      {photoDetail.photo && (
        <PhotoModal
          photo={photoDetail.photo}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={photoDetail.close}
          onLike={photoDetail.toggleLike}
          onCommentAdded={photoDetail.onCommentAdded}
          onViewOnMap={onViewOnMap ? (shopId) => { photoDetail.close(); onViewOnMap(shopId) } : undefined}
        />
      )}
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// ShopCard — a contender on the scoreboard
// ───────────────────────────────────────────────────────────────────────────

interface ShopCardProps {
  shopId: string
  rank: number
  showRank: boolean
  name: string
  address: string
  reviews: Review[]
  avgRating: number
  photos: ReviewPhoto[]
  slug: string | null
  onViewOnMap?: (shopId: string) => void
}

function ShopCard({
  shopId, slug, rank, showRank, name, address, reviews, avgRating, photos,
  onViewOnMap,
}: ShopCardProps) {
  const isPodium = showRank && rank <= 3
  const podiumTag = rank === 1 ? 'Champ' : rank === 2 ? 'Runner-up' : rank === 3 ? 'Third' : null

  return (
    <div className="relative animate-slide-up">
      {/* Podium tape — sibling of the card so .card's overflow-hidden doesn't clip it */}
      {isPodium && podiumTag && (
        <span
          className={`absolute -top-3 left-3 z-20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-crowd
            rounded shadow-sticker-sm border-2 border-night-900 select-none pointer-events-none
            ${rank === 1 ? 'bg-gold-300 text-night-900' : rank === 2 ? 'bg-cream-50 text-night-900' : 'bg-ember-300 text-night-900'}`}
          style={{ transform: 'rotate(-4deg)' }}
        >
          {podiumTag}
        </span>
      )}

      <div className={`card ${isPodium ? 'shadow-sticker' : ''}`}>
      {/* Header row — whole-row link to spot page */}
      <Link
        to={slug ? `/spots/${slug}` : '#'}
        className="block w-full text-left px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-cream-100/60 transition-colors"
      >
        {/* Rank stencil */}
        {showRank && (
          <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
            <span className={`font-display uppercase leading-none
              ${isPodium ? 'text-sauce-500' : 'text-night-300'}`}
              style={{ fontSize: isPodium ? '2.75rem' : '2rem' }}
            >
              {rank}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-display uppercase tracking-wide text-night-900 leading-tight text-xl sm:text-2xl">
            {name}
          </h3>
          <div className="flex items-center gap-2 mt-1 min-w-0">
            <p className="text-xs text-charcoal-500 truncate">{address}</p>
            {onViewOnMap && (
              <button
                type="button"
                onClick={e => { e.preventDefault(); e.stopPropagation(); onViewOnMap(shopId) }}
                className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-crowd text-sauce-600 hover:text-sauce-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sauce-400 rounded transition-colors cursor-pointer"
                aria-label="View on map"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Map
              </button>
            )}
          </div>

          {/* Rating + reviewer stack */}
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            <RatingChip rating={avgRating} count={reviews.length} hot={avgRating >= 8} />

            {/* Reviewer avatar stack — secondary */}
            {reviews.length > 0 && (
              <div className="flex -space-x-2">
                {reviews.slice(0, 4).map((r, i) => (
                  <div
                    key={r.id}
                    className="w-6 h-6 rounded-full overflow-hidden border-2 border-cream-50 bg-night-700 flex items-center justify-center"
                    style={{ zIndex: 4 - i }}
                  >
                    {r.reviewer_avatar ? (
                      <img src={r.reviewer_avatar} alt={r.reviewer_name ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-extrabold text-cream-50 uppercase">
                        {(r.reviewer_name ?? r.reviewer_email ?? '?').charAt(0)}
                      </span>
                    )}
                  </div>
                ))}
                {reviews.length > 4 && (
                  <div className="w-6 h-6 rounded-full border-2 border-cream-50 bg-night-800 flex items-center justify-center">
                    <span className="text-[9px] text-cream-50 font-extrabold">+{reviews.length - 4}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cover photo */}
        {photos.length > 0 && (
          <div className="flex-shrink-0">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 border-night-900 shadow-sticker-sm bg-cream-200">
              <img src={photos[0].url} alt="" className="w-full h-full object-cover" loading="lazy" />
              {photos.length > 1 && (
                <span className="absolute bottom-0.5 right-0.5 bg-night-900/85 text-cream-50 text-[9px] font-extrabold uppercase tracking-crowd px-1 py-0.5 rounded">
                  {photos.length}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Forward chevron — leads to spot page */}
        <div className="flex-shrink-0 self-center text-night-400">
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </div>
      </Link>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Bits
// ───────────────────────────────────────────────────────────────────────────

function RatingChip({ rating, count, hot }: { rating: number; count: number; hot: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border-2 border-night-900 shadow-sticker-sm
        text-[12px] font-extrabold uppercase tracking-crowd
        ${hot ? 'bg-sauce-400 text-cream-50' : 'bg-cream-50 text-night-900'}`}
    >
      <span className="text-base leading-none">{hot ? '🔥' : '🍗'}</span>
      <StarRating value={rating} size="sm" />
      <span>{rating.toFixed(1)}</span>
      {count > 1 && (
        <span className="opacity-70 normal-case font-bold tracking-normal">· avg of {count}</span>
      )}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="relative flex flex-col items-center justify-center py-20 px-6 text-center overflow-hidden">
      <div className="absolute inset-0 bg-splatter opacity-15 pointer-events-none" aria-hidden="true" />
      <div className="relative">
        <div className="inline-flex items-center justify-center mb-5">
          <img src="/favicon.svg" alt="" className="w-16 h-16 rounded-xl border-2 border-night-900 shadow-sticker" />
        </div>
        <p className="eyebrow mb-2">Empty scoreboard</p>
        <h3 className="font-display uppercase tracking-wide text-3xl text-night-900 leading-tight mb-3">
          Nobody's on the board yet
        </h3>
        <p className="text-sm text-charcoal-500 max-w-xs mx-auto leading-relaxed">
          Tap the <span className="font-extrabold text-sauce-500 uppercase">+ Rate</span> button to drop the first wing spot. Set the bar.
        </p>
      </div>
    </div>
  )
}
