import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import StarRating from './ui/StarRating'
import PhotoModal from './gallery/PhotoModal'
import { usePhotoDetail } from '../hooks/usePhotoDetail'
import { useHistoryModal } from '../hooks/useHistoryModal'
import type { SpotWithReviews, Review, ReviewPhoto } from '../lib/types'

type SortKey = 'name' | 'rating'
/** Local-only sort options — 'near' lives inside ListView (Home only knows name/rating). */
type SortOption = SortKey | 'near'

// ───────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for tests)
// ───────────────────────────────────────────────────────────────────────────

export function averageRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0
  return reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length
}

/**
 * Apply the per-reviewer filter: keep only that reviewer's reviews and
 * recompute avg_rating from them (the spot-wide average would be a lie).
 */
export function filterShopsByReviewer(shops: SpotWithReviews[], reviewerId: string): SpotWithReviews[] {
  if (reviewerId === 'all') return shops
  return shops
    .map(s => {
      const reviews = s.reviews.filter(r => r.user_id === reviewerId)
      return { ...s, reviews, avg_rating: averageRating(reviews) }
    })
    .filter(s => s.reviews.length > 0)
}

/** Case-insensitive substring search across spot name, address, and review flavors. */
export function filterShopsBySearch(shops: SpotWithReviews[], query: string): SpotWithReviews[] {
  const q = query.trim().toLowerCase()
  if (!q) return shops
  return shops.filter(({ spot, reviews }) => {
    if (spot.name.toLowerCase().includes(q)) return true
    if (spot.address.toLowerCase().includes(q)) return true
    return reviews.some(r =>
      (r.wing_flavors ?? []).some(f => f.toLowerCase().includes(q)) ||
      (r.wing_flavor?.toLowerCase().includes(q) ?? false)
    )
  })
}

/** Great-circle distance in miles between two lat/lng points. */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8 // Earth radius, miles
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatMiles(mi: number): string {
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`
}

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
  useHistoryModal(!!photoDetail.review, photoDetail.close)

  const [search, setSearch] = useState('')
  const [nearMe, setNearMe] = useState(false)
  const [nearLoc, setNearLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  const selectSort = (key: SortOption) => {
    if (key !== 'near') {
      setNearMe(false)
      setSortBy(key)
      return
    }
    if (nearMe || locating) return
    if (nearLoc) {
      setNearMe(true)
      return
    }
    if (!('geolocation' in navigator)) {
      toast.error("Location isn't available on this device")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setNearLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setNearMe(true)
        setLocating(false)
      },
      () => {
        // Denied or failed — keep whatever sort was already active
        setLocating(false)
        toast.error("Couldn't get your location — keeping the current sort")
      },
    )
  }

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
    const filtered = filterShopsBySearch(filterShopsByReviewer(shops, filterReviewer), search)
      .filter(s => s.reviews.length > 0)

    if (nearMe && nearLoc) {
      return [...filtered].sort((a, b) =>
        haversineMiles(nearLoc, a.spot) - haversineMiles(nearLoc, b.spot))
    }
    return [...filtered].sort((a, b) => {
      if (sortBy === 'rating') return b.avg_rating - a.avg_rating
      return a.spot.name.localeCompare(b.spot.name)
    })
  }, [shops, sortBy, filterReviewer, search, nearMe, nearLoc])

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

  const shopsWithReviews = sorted
  // Anything on the board at all (pre-search/filter)? Controls stay visible even
  // when the current search/filter matches nothing, so you can back out of it.
  const hasAnyOnBoard = shops.some(s => s.reviews.length > 0)
  const showRanks = sortBy === 'rating' && !nearMe

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Page heading */}
        {hasAnyOnBoard && (
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow mb-1">The scoreboard</p>
              <h2 className="font-display uppercase text-3xl sm:text-4xl text-night-900 leading-tight tracking-wide">
                {nearMe ? 'Closest to you' : sortBy === 'rating' ? 'Who runs the streets' : 'Every spot on the board'}
              </h2>
            </div>
            <div className="sticker-night flex-shrink-0 hidden sm:inline-flex">
              {shopsWithReviews.length} {shopsWithReviews.length === 1 ? 'spot' : 'spots'}
            </div>
          </div>
        )}

        {/* Search */}
        {hasAnyOnBoard && (
          <div className="mb-4 relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search spots, addresses, flavors…"
              aria-label="Search spots by name, address, or flavor"
              className="input pr-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center
                           rounded-full text-night-700 hover:text-night-900 hover:bg-cream-200
                           text-xl font-extrabold leading-none transition-colors cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Controls */}
        {hasAnyOnBoard && (
          <div className="mb-5 flex items-center gap-3 flex-wrap">
            {/* Sort toggle */}
            <div className="flex items-center gap-2">
              <span className="eyebrow text-night-700">Sort</span>
              <div className="flex items-center bg-night-900 rounded-full p-1 border-2 border-night-900 shadow-sticker-sm">
                {([['name', 'A→Z'], ['rating', 'Heat'], ['near', 'Near me']] as [SortOption, string][]).map(([key, label]) => {
                  const active = key === 'near' ? nearMe : !nearMe && sortBy === key
                  return (
                    <button
                      key={key}
                      onClick={() => selectSort(key)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-crowd transition-all
                        ${active
                          ? 'bg-sauce-400 text-cream-50'
                          : 'text-cream-200/70 hover:text-cream-50'}`}
                    >
                      {key === 'near' && locating ? 'Locating…' : label}
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
                    /* text-base (16px): anything smaller makes iOS Safari zoom the page on focus */
                    className="appearance-none text-base font-extrabold uppercase tracking-wide
                               rounded-full border-2 border-night-900 bg-cream-50 text-night-900
                               pl-3 pr-8 py-1 shadow-sticker-sm
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
          hasAnyOnBoard
            ? <NoMatchState query={search} onClear={() => setSearch('')} />
            : <EmptyState />
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
                distanceMi={nearMe && nearLoc ? haversineMiles(nearLoc, spot) : null}
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

      {photoDetail.review && (
        <PhotoModal
          review={photoDetail.review}
          initialPhotoIndex={photoDetail.initialIndex}
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
  distanceMi?: number | null
  onViewOnMap?: (shopId: string) => void
}

function ShopCard({
  shopId, slug, rank, showRank, name, address, reviews, avgRating, photos,
  distanceMi, onViewOnMap,
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

            {/* Distance — only when "Near me" sort is active */}
            {distanceMi != null && (
              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-crowd text-night-700">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {formatMiles(distanceMi)}
              </span>
            )}

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

function NoMatchState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center py-20 px-6 text-center overflow-hidden">
      <div className="absolute inset-0 bg-splatter opacity-15 pointer-events-none" aria-hidden="true" />
      <div className="relative">
        <p className="eyebrow mb-2">No spots match</p>
        <h3 className="font-display uppercase tracking-wide text-3xl text-night-900 leading-tight mb-3">
          Nothing on the board{query.trim() ? <> for “{query.trim()}”</> : null}
        </h3>
        {query.trim() ? (
          <button type="button" onClick={onClear} className="sticker-sauce cursor-pointer">
            Clear search
          </button>
        ) : (
          <p className="text-sm text-charcoal-500 max-w-xs mx-auto leading-relaxed">
            Try a different filter.
          </p>
        )}
      </div>
    </div>
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
