import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GalleryReviewItem } from '../../lib/types'
import HeartIcon from './HeartIcon'
import LikedByOverlay from './LikedByOverlay'
import { fetchReviewLikers } from '../../lib/reactionDetails'
import { useUserProfile } from '../UserProfileContext'
import { useCarouselSwipe } from './useCarouselSwipe'

interface Props {
  review: GalleryReviewItem
  onOpen: () => void
  onLike: () => void
}

export default function ReviewCard({ review, onOpen, onLike }: Props) {
  const { openProfile } = useUserProfile()
  const fetchLikers = useCallback(() => fetchReviewLikers(review.review_id), [review.review_id])
  const primaryPhoto = review.photos[0]
  const extraCount = review.photos.length - 1
  const [carouselIndex, setCarouselIndex] = useState(0)
  const swipeHandlers = useCarouselSwipe(
    () => setCarouselIndex(i => Math.max(0, i - 1)),
    () => setCarouselIndex(i => Math.min(review.photos.length - 1, i + 1)),
  )

  if (!primaryPhoto) return null

  const displayPhoto = review.photos[carouselIndex] ?? primaryPhoto

  return (
    <div
      className="group relative aspect-square bg-warmgray-100 rounded-2xl overflow-hidden cursor-pointer"
      {...(review.photos.length > 1 ? swipeHandlers : {})}
    >
      <img
        src={displayPhoto.photo_url}
        alt={review.spot_name}
        loading="lazy"
        onClick={onOpen}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {review.photos.length > 1 && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 z-10">
          {review.photos.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setCarouselIndex(i) }}
              className="w-6 h-6 flex items-center justify-center"
              aria-label={`Photo ${i + 1}`}
            >
              <span className={`block w-1.5 h-1.5 rounded-full transition-all ${
                i === carouselIndex
                  ? 'bg-white scale-110 shadow-sm'
                  : 'bg-white/50 hover:bg-white/70'
              }`} />
            </button>
          ))}
        </div>
      )}

      {extraCount > 0 && carouselIndex === 0 && (
        <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 z-10">
          <span className="text-white text-xs font-medium">+{extraCount}</span>
        </div>
      )}

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent
                   opacity-0 group-hover:opacity-100 sm:transition-opacity sm:duration-200
                   max-sm:opacity-100"
        onClick={onOpen}
      />

      <div
        className="absolute bottom-0 left-0 right-0 px-3 py-2.5
                   opacity-0 group-hover:opacity-100 sm:transition-opacity sm:duration-200
                   max-sm:opacity-100"
        onClick={onOpen}
      >
        {review.spot_slug ? (
          <Link
            to={`/spots/${review.spot_slug}`}
            onClick={e => e.stopPropagation()}
            className="block text-white text-xs font-semibold leading-tight truncate drop-shadow hover:text-sauce-300 transition-colors"
          >
            {review.spot_name}
          </Link>
        ) : (
          <p className="text-white text-xs font-semibold leading-tight truncate drop-shadow">
            {review.spot_name}
          </p>
        )}
        <button
          type="button"
          onClick={e => { e.stopPropagation(); openProfile(review.reviewer_id) }}
          className="text-white/70 text-xs truncate drop-shadow hover:text-white transition-colors text-left max-w-full"
        >
          {review.reviewer_name ?? review.reviewer_email?.split('@')[0] ?? 'Unknown'}
        </button>
      </div>

      <LikedByOverlay
        fetchUsers={fetchLikers}
        count={review.like_count}
        label="Likes"
        className="absolute top-2 right-2 inline-flex z-10"
      >
        <button
          onClick={e => { e.stopPropagation(); onLike() }}
          className="flex items-center gap-1 bg-black/30 hover:bg-black/50
                     backdrop-blur-sm rounded-full px-2 py-1 transition-colors"
          aria-label={review.is_liked_by_me ? 'Unlike' : 'Like'}
        >
          <HeartIcon
            filled={review.is_liked_by_me}
            className={`w-3.5 h-3.5 transition-colors ${review.is_liked_by_me ? 'text-amber-400' : 'text-white'}`}
          />
          {review.like_count > 0 && (
            <span className="text-white text-xs font-medium">{review.like_count}</span>
          )}
        </button>
      </LikedByOverlay>

      {review.comment_count > 0 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1 z-10">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-white text-xs font-medium">{review.comment_count}</span>
        </div>
      )}
    </div>
  )
}
