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
import { cleanUserText } from '../../lib/userText'
import { useUserProfile } from '../UserProfileContext'
import { useDragCarousel } from './useDragCarousel'

/**
 * Real photos always live in storage. A `data:` URL is a stand-in some
 * imported rows use for a file that no longer exists (a "no photo found"
 * picture), so it's treated like a photo that failed to load.
 */
function isPlaceholderPhoto(url: string) {
  return url.startsWith('data:')
}

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
  // Photos that fail to load (deleted file, corrupt upload) are dropped from
  // the carousel; if none are left the card shows a one-line note instead of
  // a big empty photo frame.
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(() => new Set())
  const [commentCount, setCommentCount] = useState(review.comment_count)

  const photos = review.photos.filter(p => !brokenPhotos.has(p.photo_id) && !isPlaceholderPhoto(p.photo_url))
  const photosUnavailable = review.photos.length > 0 && photos.length === 0
  const activeIndex = Math.min(carouselIndex, Math.max(0, photos.length - 1))
  const { containerProps, trackStyle } = useDragCarousel(photos.length, activeIndex, setCarouselIndex)
  const name = cleanUserText(review.reviewer_name ?? review.reviewer_email?.split('@')[0] ?? 'Unknown') || 'Unknown'
  const spotName = cleanUserText(review.spot_name)
  const initials = name.charAt(0).toUpperCase()

  // visited_at is a calendar date: "today" / "yesterday" / "3 days ago",
  // never "22 hours ago" from a UTC-midnight parse.
  const visitedLabel = relativeVisitDate(review.visited_at)
  // gallery_feed doesn't expose wing_size yet; show it as soon as it does.
  const wingSize = (review as GalleryReviewItem & { wing_size?: string | null }).wing_size ?? null
  const photoAlt = (i: number) =>
    `Photo${photos.length > 1 ? ` ${i + 1} of ${photos.length}` : ''} of wings at ${spotName}, from ${name}'s review`

  return (
    <article className="bg-cream-50 border-2 border-night-900/10 rounded-2xl overflow-hidden shadow-sm">
      {/* Header: avatar + reviewer + spot + rating. Name and spot are each a
          44px-tall tap target; their text hugs the line between them so the
          header still reads as two compact lines. */}
      <div className="flex items-center gap-3 px-4 pt-1">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); openProfile(review.reviewer_id) }}
          className="group/avatar flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full"
          aria-label={`View ${name}'s profile`}
        >
          <span className="w-10 h-10 rounded-full overflow-hidden border-2 border-night-900 bg-night-700 flex items-center justify-center shadow-sticker-sm group-hover/avatar:border-sauce-400 transition-colors">
            <AvatarImage
              src={review.reviewer_avatar}
              alt=""
              className="w-full h-full object-cover"
              fallback={<span className="text-sm font-extrabold text-cream-50 uppercase">{initials}</span>}
            />
          </span>
        </button>

        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); openProfile(review.reviewer_id) }}
            className="flex items-end max-w-full min-h-[44px] pb-0.5 text-left font-extrabold text-sm text-night-900 uppercase tracking-crowd hover:text-sauce-500 transition-colors leading-tight"
          >
            <span className="truncate user-text">{name}</span>
          </button>
          <div className="flex items-start min-w-0 text-xs text-charcoal-400 leading-none">
            {review.spot_slug ? (
              <Link
                to={`/spots/${review.spot_slug}`}
                onClick={e => e.stopPropagation()}
                className="block min-w-0 min-h-[44px] pt-1 truncate font-semibold text-charcoal-600 hover:text-sauce-500 transition-colors user-text"
              >
                {spotName}
              </Link>
            ) : (
              <span className="block min-w-0 min-h-[44px] pt-1 truncate font-semibold text-charcoal-600 user-text">{spotName}</span>
            )}
            {visitedLabel && <span className="flex-shrink-0 pt-1 whitespace-pre"> · visited {visitedLabel}</span>}
          </div>
        </div>

        {/* Rating badge */}
        <button
          type="button"
          onClick={onOpen}
          className="flex-shrink-0 flex flex-col items-center justify-center min-h-[44px] bg-sauce-400 text-cream-50 rounded-xl px-2.5 py-1.5 border-2 border-night-900 shadow-sticker-sm hover:bg-sauce-300 transition-colors"
          aria-label={`Rating: ${Number(review.overall_rating).toFixed(1)}/10`}
        >
          <span className="font-display text-xl leading-none">{Number(review.overall_rating).toFixed(1)}</span>
          <span className="text-[8px] uppercase tracking-crowd opacity-80 leading-none mt-0.5">/10</span>
        </button>
      </div>

      {/* Photo carousel — the 4:3 box is reserved up front, so the card
          doesn't jump when the photo arrives */}
      {photos.length > 0 && (
        <div
          className="relative aspect-[4/3] bg-night-800 overflow-hidden touch-pan-y"
          {...(photos.length > 1 ? containerProps : {})}
        >
          {/* The track below sets an inline `transform`, creating a new stacking
              context. The absolutely-positioned open button below only stays
              clickable above the track because it FOLLOWS the track in DOM
              order — don't reorder these two elements. */}
          <div className="flex h-full w-full" style={photos.length > 1 ? trackStyle : undefined}>
            {photos.map((p, i) => (
              <img
                key={p.photo_id}
                src={p.photo_url}
                alt={photoAlt(i)}
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
            aria-label={`Open ${spotName} review`}
            className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sauce-400"
          />

          {/* Multi-photo dots — 44px tap targets while keeping the visible dot tiny */}
          {photos.length > 1 && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center z-10">
              {photos.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setCarouselIndex(i) }}
                  className="w-11 h-11 flex items-center justify-center"
                  aria-label={`Photo ${i + 1}`}
                >
                  <span className={`block rounded-full transition-all ${
                    i === activeIndex
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

      {/* None of this review's photos could be loaded: one quiet line
          instead of a full-height empty frame */}
      {photosUnavailable && (
        <p className="mx-4 mt-1 px-3 py-2 rounded-lg bg-cream-100 text-xs text-charcoal-500">
          {review.photos.length > 1 ? 'Photos unavailable' : 'Photo unavailable'}
        </p>
      )}

      {/* Review text excerpt */}
      {review.review_text && (
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left px-4 pt-3 pb-1"
        >
          <p className="text-sm text-charcoal-700 line-clamp-3 leading-relaxed break-words user-text">
            &ldquo;{cleanUserText(review.review_text)}&rdquo;
          </p>
        </button>
      )}

      {/* Flavor + size tags */}
      {(review.wing_flavor || wingSize) && (
        <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5">
          {review.wing_flavor && (
            <span className="inline-block max-w-full truncate bg-sauce-50 text-sauce-600 border border-sauce-200 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-crowd user-text">
              {cleanUserText(review.wing_flavor)}
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
            <span className="text-xs">
              {review.like_count > 0
                ? `${review.like_count} ${review.like_count === 1 ? 'like' : 'likes'}`
                : 'Like'}
            </span>
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
        >
          <svg className={`w-4 h-4 ${showComments ? 'text-sauce-500' : 'text-charcoal-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-xs">
            {commentCount > 0
              ? `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`
              : 'Comment'}
          </span>
        </button>

        {/* Share — native sheet, clipboard, or a copyable link field */}
        <ShareButton
          title={`${spotName} review`}
          text={`A ${Number(review.overall_rating).toFixed(1)}/10 wing review of ${spotName}`}
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
          <svg className="w-4 h-4 text-charcoal-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
