import { useCallback, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import type { GalleryReviewItem } from '../../lib/types'
import HeartIcon from './HeartIcon'
import LikedByOverlay from './LikedByOverlay'
import { fetchReviewLikers } from '../../lib/reactionDetails'
import { useUserProfile } from '../UserProfileContext'

interface Props {
  review: GalleryReviewItem
  onOpen: () => void
  onLike: () => void
}

export default function ReviewFeedCard({ review, onOpen, onLike }: Props) {
  const { openProfile } = useUserProfile()
  const fetchLikers = useCallback(() => fetchReviewLikers(review.review_id), [review.review_id])
  const [carouselIndex, setCarouselIndex] = useState(0)

  const primaryPhoto = review.photos[0]
  const displayPhoto = review.photos[carouselIndex] ?? primaryPhoto
  const name = review.reviewer_name ?? review.reviewer_email?.split('@')[0] ?? 'Unknown'
  const initials = name.charAt(0).toUpperCase()

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(review.visited_at), { addSuffix: true })
    } catch {
      return ''
    }
  })()

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation()
    const url = `${window.location.origin}${window.location.pathname}?review=${review.review_id}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied', { duration: 2000 })
    }).catch(() => {
      toast.error('Could not copy link')
    })
  }

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
          {review.reviewer_avatar ? (
            <img src={review.reviewer_avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-extrabold text-cream-50 uppercase">{initials}</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); openProfile(review.reviewer_id) }}
            className="font-extrabold text-sm text-night-900 uppercase tracking-crowd hover:text-sauce-500 transition-colors leading-none"
          >
            {name}
          </button>
          <div className="text-xs text-charcoal-400 mt-0.5 leading-none truncate">
            <span className="font-semibold text-charcoal-600">{review.spot_name}</span>
            {timeAgo && <span> · {timeAgo}</span>}
          </div>
        </div>

        {/* Rating badge */}
        <button
          type="button"
          onClick={onOpen}
          className="flex-shrink-0 flex flex-col items-center bg-sauce-400 text-cream-50 rounded-xl px-2.5 py-1.5 border-2 border-night-900 shadow-sticker-sm hover:bg-sauce-300 transition-colors"
          aria-label={`Rating: ${review.overall_rating}/10`}
        >
          <span className="font-display text-xl leading-none">{review.overall_rating}</span>
          <span className="text-[8px] uppercase tracking-crowd opacity-80 leading-none mt-0.5">/10</span>
        </button>
      </div>

      {/* Photo carousel */}
      {primaryPhoto && (
        <div className="relative aspect-[4/3] bg-night-800 cursor-pointer" onClick={onOpen}>
          <img
            src={displayPhoto.photo_url}
            alt={review.spot_name}
            loading="lazy"
            className="w-full h-full object-cover"
          />

          {/* Multi-photo dots */}
          {review.photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
              {review.photos.map((_, i) => (
                <button
                  key={i}
                  onClick={e => { e.stopPropagation(); setCarouselIndex(i) }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === carouselIndex
                      ? 'bg-white scale-110 shadow-sm'
                      : 'bg-white/50 hover:bg-white/70'
                  }`}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Event badge */}
          {review.event_id && review.event_name && (
            <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-400/95 text-charcoal-800 rounded-full px-2.5 py-0.5 shadow-sm pointer-events-none">
              <span className="text-[10px]">🏆</span>
              <span className="text-[10px] font-bold uppercase tracking-wide truncate max-w-[120px]">
                {review.event_name}
              </span>
            </div>
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
          <p className="text-sm text-charcoal-700 line-clamp-3 leading-relaxed">
            &ldquo;{review.review_text}&rdquo;
          </p>
        </button>
      )}

      {/* Flavor tag */}
      {review.wing_flavor && (
        <div className="px-4 pt-2 pb-1">
          <span className="inline-block bg-sauce-50 text-sauce-600 border border-sauce-200 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-crowd">
            {review.wing_flavor}
          </span>
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
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
              review.is_liked_by_me
                ? 'text-sauce-500 bg-sauce-50 hover:bg-sauce-100'
                : 'text-charcoal-500 hover:bg-cream-100'
            }`}
            aria-label={review.is_liked_by_me ? 'Unlike' : 'Like'}
          >
            <HeartIcon
              filled={review.is_liked_by_me}
              className={`w-4 h-4 ${review.is_liked_by_me ? 'text-sauce-500' : 'text-charcoal-400'}`}
            />
            {review.like_count > 0 && (
              <span className="tabular-nums">{review.like_count}</span>
            )}
          </button>
        </LikedByOverlay>

        {/* Comment */}
        <button
          onClick={onOpen}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-charcoal-500 hover:bg-cream-100 transition-colors"
          aria-label="View comments"
        >
          <svg className="w-4 h-4 text-charcoal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {review.comment_count > 0 && (
            <span className="tabular-nums">{review.comment_count}</span>
          )}
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-charcoal-500 hover:bg-cream-100 transition-colors ml-auto"
          aria-label="Share review"
        >
          <svg className="w-4 h-4 text-charcoal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </div>
    </article>
  )
}
