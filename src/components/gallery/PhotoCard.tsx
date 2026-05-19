import { useCallback } from 'react'
import type { GalleryPhoto } from '../../lib/types'
import HeartIcon from './HeartIcon'
import LikedByOverlay from './LikedByOverlay'
import { fetchReviewLikers } from '../../lib/reactionDetails'

interface Props {
  photo: GalleryPhoto
  onOpen: () => void
  onLike: () => void
}

export default function PhotoCard({ photo, onOpen, onLike }: Props) {
  const fetchLikers = useCallback(() => fetchReviewLikers(photo.review_id), [photo.review_id])

  return (
    <div className="group relative aspect-square bg-warmgray-100 rounded-2xl overflow-hidden cursor-pointer">
      {/* Image */}
      <img
        src={photo.photo_url}
        alt={photo.spot_name}
        loading="lazy"
        onClick={onOpen}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {/* Hover overlay (desktop) — always visible on mobile */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent
                   opacity-0 group-hover:opacity-100 sm:transition-opacity sm:duration-200
                   max-sm:opacity-100"
        onClick={onOpen}
      />

      {/* Bottom info strip */}
      <div
        className="absolute bottom-0 left-0 right-0 px-3 py-2.5
                   opacity-0 group-hover:opacity-100 sm:transition-opacity sm:duration-200
                   max-sm:opacity-100"
        onClick={onOpen}
      >
        <p className="text-white text-xs font-semibold leading-tight truncate drop-shadow">
          {photo.spot_name}
        </p>
        <p className="text-white/70 text-xs truncate drop-shadow">
          {photo.reviewer_name ?? photo.reviewer_email?.split('@')[0] ?? 'Unknown'}
        </p>
      </div>

      {/* Like button — top-right corner */}
      <LikedByOverlay
        fetchUsers={fetchLikers}
        count={photo.like_count}
        label="Likes"
        className="absolute top-2 right-2 inline-flex"
      >
        <button
          onClick={e => { e.stopPropagation(); onLike() }}
          className="flex items-center gap-1 bg-black/30 hover:bg-black/50
                     backdrop-blur-sm rounded-full px-2 py-1 transition-colors"
          aria-label={photo.is_liked_by_me ? 'Unlike' : 'Like'}
        >
          <HeartIcon
            filled={photo.is_liked_by_me}
            className={`w-3.5 h-3.5 transition-colors ${photo.is_liked_by_me ? 'text-amber-400' : 'text-white'}`}
          />
          {photo.like_count > 0 && (
            <span className="text-white text-xs font-medium">{photo.like_count}</span>
          )}
        </button>
      </LikedByOverlay>

      {/* Comment count badge — only if > 0 */}
      {photo.comment_count > 0 && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1">
          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-white text-xs font-medium">{photo.comment_count}</span>
        </div>
      )}

      {/* Event badge — bottom-left corner */}
      {photo.event_id && photo.event_name && (
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-amber-400/95 text-charcoal-800 rounded-full px-2 py-0.5 shadow-sm pointer-events-none">
          <span className="text-[10px]">🏆</span>
          <span className="text-[10px] font-bold uppercase tracking-wide truncate max-w-[100px]">
            {photo.event_name}
          </span>
        </div>
      )}
    </div>
  )
}
