import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GalleryReviewItem } from '../../lib/types'
import { relativeVisitDate } from '../../lib/dates'
import HeartIcon from './HeartIcon'
import LikedByOverlay from './LikedByOverlay'
import ReviewCommentThread from '../ReviewCommentThread'
import AvatarImage from '../ui/AvatarImage'
import ShareButton from '../ui/ShareButton'
import { fetchReviewLikers } from '../../lib/reactionDetails'
import { useUserProfile } from '../UserProfileContext'
import { useDragCarousel } from './useDragCarousel'

interface Props {
  review: GalleryReviewItem
  currentUserId: string
  isAdmin: boolean
  onOpen: () => void
  onLike: () => void
}

export default function ReviewFeedCard({ review, currentUserId, isAdmin, onOpen, onLike }: Props) {
  const { openProfile } = useUserProfile()
  const fetchLikers = useCallback(() => fetchReviewLikers(review.review_id), [review.review_id])
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [showComments, setShowComments] = useState(false)
  // Photos that fail to load (deleted file, corrupt upload) get a placeholder
  // instead of a black box with a broken-image icon.
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(() => new Set())
  const [commentCount, setCommentCount] = useState(review.comment_count)

  const primaryPhoto = review.photos[0]
  const { containerProps, trackStyle } = useDragCarousel(review.photos.length, carouselIndex, setCarouselIndex)
  const name = review.reviewer_name ?? review.reviewer_email?.split('@')[0] ?? 'Unknown'
  const initials = name.charAt(0).toUpperCase()

  // visited_at is a calendar date: "today" / "yesterday" / "3 days ago",
  // never "22 hours ago" from a UTC-midnight parse.
  const visitedLabel = relativeVisitDate(review.visited_at)
  // gallery_feed doesn't expose wing_size yet; show it as soon as it does.
  const wingSize = (review as GalleryReviewItem & { wing_size?: string | null }).wing_size ?? null

  return (
    <article className="bg-cream-50 border-2 border-night-900/10 rounded-2xl overflow-hidden shadow-sm">
      {/* Header: avatar + reviewer + spot + rating */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); openProfile(review.reviewer_id) }}
          className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden border-2 border-night-900 bg-night-700 flex items-center justify-center shadow-sticker-sm hover:border-sauce-400 transition-colors"
          aria-label={`View ${name}'s profile`}
        >
          <AvatarImage
            src={review.reviewer_avatar}
            alt={name}
            className="w-full h-full object-cover"
            fallback={<span className="text-sm font-extrabold text-cream-50 uppercase">{initials}</span>}
          />
        </button>

        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); openProfile(review.reviewer_id) }}
            className="block max-w-full truncate text-left font-extrabold text-sm text-night-900 uppercase tracking-crowd hover:text-sauce-500 transition-colors leading-tight"
          >
            {name}
          </button>
          <div className="text-xs text-charcoal-400 mt-0.5 leading-none truncate">
            {review.spot_slug ? (
              <Link
                to={`/spots/${review.spot_slug}`}
                onClick={e => e.stopPropagation()}
                className="font-semibold text-charcoal-600 hover:text-sauce-500 transition-colors"
              >
                {review.spot_name}
              </Link>
            ) : (
              <span className="font-semibold text-charcoal-600">{review.spot_name}</span>
            )}
            {visitedLabel && <span> · visited {visitedLabel}</span>}
          </div>
        </div>

        {/* Rating badge */}
        <button
          type="button"
          onClick={onOpen}
          className="flex-shrink-0 flex flex-col items-center bg-sauce-400 text-cream-50 rounded-xl px-2.5 py-1.5 border-2 border-night-900 shadow-sticker-sm hover:bg-sauce-300 transition-colors"
          aria-label={`Rating: ${Number(review.overall_rating).toFixed(1)}/10`}
        >
          <span className="font-display text-xl leading-none">{Number(review.overall_rating).toFixed(1)}</span>
          <span className="text-[8px] uppercase tracking-crowd opacity-80 leading-none mt-0.5">/10</span>
        </button>
      </div>

      {/* Photo carousel */}
      {primaryPhoto && (
        <div
          className="relative aspect-[4/3] bg-night-800 overflow-hidden touch-pan-y"
          {...(review.photos.length > 1 ? containerProps : {})}
        >
          {/* The track below sets an inline `transform`, creating a new stacking
              context. The absolutely-positioned open button below only stays
              clickable above the track because it FOLLOWS the track in DOM
              order — don't reorder these two elements. */}
          <div className="flex h-full w-full" style={review.photos.length > 1 ? trackStyle : undefined}>
            {review.photos.map(p => brokenPhotos.has(p.photo_id) ? (
              <div
                key={p.photo_id}
                className="w-full h-full flex-shrink-0 flex flex-col items-center justify-center gap-1 bg-cream-100 text-charcoal-500"
              >
                <span className="text-3xl" aria-hidden="true">🍗</span>
                <span className="text-xs font-bold">Photo unavailable</span>
              </div>
            ) : (
              <img
                key={p.photo_id}
                src={p.photo_url}
                alt={review.spot_name}
                loading="lazy"
                draggable={false}
                onError={() => setBrokenPhotos(prev => new Set(prev).add(p.photo_id))}
                className="w-full h-full flex-shrink-0 object-cover"
              />
            ))}
          </div>

          {/* Full-bleed open target — sits under the dots so they stay clickable */}
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${review.spot_name} review`}
            className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sauce-400"
          />

          {/* Multi-photo dots — 44px tap targets while keeping the visible dot tiny */}
          {review.photos.length > 1 && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center z-10">
              {review.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setCarouselIndex(i) }}
                  className="w-11 h-11 flex items-center justify-center"
                  aria-label={`Photo ${i + 1}`}
                >
                  <span className={`block rounded-full transition-all ${
                    i === carouselIndex
                      ? 'bg-cream-50 w-2.5 h-2.5 shadow-sm'
                      : 'bg-cream-50/55 w-1.5 h-1.5 hover:bg-cream-50/75'
                  }`} />
                </button>
              ))}
            </div>
          )}

          {/* Event badge — a real link to the event, above the full-bleed
              open button so tapping it doesn't also open the review. The
              outer link is the 44px hit area; the pill inside is the visual. */}
          {review.event_id && review.event_name && (
            review.event_slug ? (
              <Link
                to={`/events/${review.event_slug}`}
                onClick={e => e.stopPropagation()}
                className="absolute top-1 left-1 z-10 min-h-[44px] flex items-center px-2 max-w-[calc(100%-0.5rem)] group/event"
                aria-label={`Event: ${review.event_name}`}
              >
                <span className="flex items-center gap-1 min-w-0 bg-gold-300/95 text-night-900 border border-night-900 rounded-full px-2.5 py-0.5 shadow-sticker-sm group-hover/event:bg-gold-300">
                  <span className="text-[10px]" aria-hidden="true">🏆</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-crowd truncate max-w-[200px]">
                    {review.event_name}
                  </span>
                </span>
              </Link>
            ) : (
              <div className="absolute top-3 left-3 flex items-center gap-1 bg-gold-300/95 text-night-900 border border-night-900 rounded-full px-2.5 py-0.5 shadow-sticker-sm pointer-events-none">
                <span className="text-[10px]">🏆</span>
                <span className="text-[10px] font-extrabold uppercase tracking-crowd truncate max-w-[120px]">
                  {review.event_name}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {/* Review text excerpt */}
      {review.review_text && (
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left px-4 pt-3 pb-1"
        >
          <p className="text-sm text-charcoal-700 line-clamp-3 leading-relaxed break-words [overflow-wrap:anywhere]">
            &ldquo;{review.review_text}&rdquo;
          </p>
        </button>
      )}

      {/* Flavor + size tags */}
      {(review.wing_flavor || wingSize) && (
        <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5">
          {review.wing_flavor && (
            <span className="inline-block max-w-full truncate bg-sauce-50 text-sauce-600 border border-sauce-200 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-crowd">
              {review.wing_flavor}
            </span>
          )}
          {wingSize && (
            <span className="inline-block bg-cream-100 text-night-800 border border-night-900/20 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-crowd">
              Size: {wingSize}
            </span>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1 px-3 py-3 border-t-2 border-night-900/8 mt-2">
        {/* Like */}
        <LikedByOverlay
          fetchUsers={fetchLikers}
          count={review.like_count}
          label="Likes"
          className="inline-flex"
        >
          <button
            onClick={e => { e.stopPropagation(); onLike() }}
            className={`flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
              review.is_liked_by_me
                ? 'text-sauce-500 bg-sauce-50 hover:bg-sauce-100'
                : 'text-charcoal-500 hover:bg-cream-100'
            }`}
            aria-pressed={review.is_liked_by_me}
            aria-label={`Like${review.like_count > 0 ? ` (${review.like_count})` : ''}`}
          >
            <HeartIcon
              filled={review.is_liked_by_me}
              className={`w-4 h-4 ${review.is_liked_by_me ? 'text-sauce-500' : 'text-charcoal-400'}`}
            />
            {review.like_count > 0 && (
              <span className="tabular-nums">{review.like_count}</span>
            )}
            <span className="text-xs">Like</span>
          </button>
        </LikedByOverlay>

        {/* Comment — toggles the inline thread open in place */}
        <button
          onClick={() => setShowComments(v => !v)}
          aria-expanded={showComments}
          className={`flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
            showComments
              ? 'text-sauce-500 bg-sauce-50 hover:bg-sauce-100'
              : 'text-charcoal-500 hover:bg-cream-100'
          }`}
          aria-label={`Comment${commentCount > 0 ? ` (${commentCount})` : ''}`}
        >
          <svg className={`w-4 h-4 ${showComments ? 'text-sauce-500' : 'text-charcoal-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {commentCount > 0 && (
            <span className="tabular-nums">{commentCount}</span>
          )}
          <span className="text-xs">Comment</span>
        </button>

        {/* Share — native sheet, clipboard, or a copyable link field */}
        <ShareButton
          title={`${review.spot_name} review`}
          text={`A ${Number(review.overall_rating).toFixed(1)}/10 wing review of ${review.spot_name}`}
          url={`${window.location.origin}/reviews/${review.review_id}`}
          className="flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold text-charcoal-500 hover:bg-cream-100 transition-colors ml-auto"
        />
      </div>

      {/* Inline comments — expands in place like a social feed */}
      {showComments ? (
        <div className="border-t-2 border-night-900/8 bg-cream-50">
          <ReviewCommentThread
            reviewId={review.review_id}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onCommentCountChange={setCommentCount}
            autoFocus
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowComments(true)}
          className="w-full min-h-[44px] flex items-center gap-2 px-4 py-3 border-t-2 border-night-900/8 bg-cream-50 text-left hover:bg-cream-100 transition-colors"
        >
          <svg className="w-4 h-4 text-charcoal-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-sm text-charcoal-400">
            {commentCount > 0
              ? `View ${commentCount === 1 ? '1 comment' : `all ${commentCount} comments`}`
              : 'Add a comment…'}
          </span>
        </button>
      )}
    </article>
  )
}
