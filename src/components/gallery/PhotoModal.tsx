import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import StarRating from '../ui/StarRating'
import CommentSection from './CommentSection'
import HeartIcon from './HeartIcon'
import GifPicker from './GifPicker'
import { Lightbox } from '../ui/PhotoGallery'
import { usePhotoInteractions } from '../../hooks/usePhotoInteractions'
import LikedByOverlay from './LikedByOverlay'
import { fetchPhotoLikers } from '../../lib/reactionDetails'
import type { GalleryPhoto } from '../../lib/types'

interface Props {
  photo: GalleryPhoto
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onLike: () => void
  onCommentAdded: () => void
}

export default function PhotoModal({
  photo,
  currentUserId,
  isAdmin,
  onClose,
  onLike,
  onCommentAdded,
}: Props) {
  const interactions = usePhotoInteractions(photo.photo_id, currentUserId)

  const [showLightbox, setShowLightbox] = useState(false)

  // Mobile input state
  const [mobileText, setMobileText] = useState('')
  const [mobilePosting, setMobilePosting] = useState(false)
  const [mobileReplyingTo, setMobileReplyingTo] = useState<{ id: string; name: string } | null>(null)
  const [mobileShowGif, setMobileShowGif] = useState(false)
  const [mobileSelectedGif, setMobileSelectedGif] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showLightbox) onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose, showLightbox])

  const handleMobilePost = async () => {
    if ((!mobileText.trim() && !mobileSelectedGif) || mobilePosting) return
    setMobilePosting(true)
    await interactions.addComment({
      text: mobileText.trim() || undefined,
      parentCommentId: mobileReplyingTo?.id ?? null,
      mediaUrl: mobileSelectedGif ?? undefined,
      contentType: mobileSelectedGif && mobileText.trim() ? 'mixed' : mobileSelectedGif ? 'gif' : 'text',
    })
    setMobileText('')
    setMobileSelectedGif(null)
    setMobileReplyingTo(null)
    setMobileShowGif(false)
    setMobilePosting(false)
    onCommentAdded()
  }

  const visitedDate = (() => {
    try { return format(new Date(photo.visited_at), 'MMM d, yyyy') }
    catch { return photo.visited_at }
  })()

  const reviewerName = photo.reviewer_name ?? photo.reviewer_email?.split('@')[0] ?? 'Unknown'

  const fetchLikers = useCallback(() => fetchPhotoLikers(photo.photo_id), [photo.photo_id])

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >

      {/* ══════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (< 640px)
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="sm:hidden bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up
                   h-[92dvh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-warmgray-100">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-charcoal-800 truncate">{photo.spot_name}</p>
            <p className="text-xs text-charcoal-400 truncate mt-0.5">{photo.spot_address}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-charcoal-400
                       hover:bg-warmgray-100 transition-colors text-lg leading-none flex-shrink-0"
            aria-label="Close"
          >×</button>
        </div>

        {/* Single scroll area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Photo */}
          <div
            className="w-full bg-warmgray-100 aspect-video overflow-hidden cursor-zoom-in"
            onClick={() => setShowLightbox(true)}
          >
            <img src={photo.photo_url} alt={photo.spot_name} className="w-full h-full object-cover" />
          </div>

          {/* Reviewer + ratings */}
          <div className="px-4 pt-3 pb-3 border-b border-warmgray-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-warmgray-200 flex-shrink-0 flex items-center justify-center">
                {photo.reviewer_avatar ? (
                  <img src={photo.reviewer_avatar} alt={reviewerName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-charcoal-500">{reviewerName.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-charcoal-700 truncate">{reviewerName}</p>
                <p className="text-xs text-charcoal-300">{visitedDate}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rating-wing text-xs">
                🍗 <StarRating value={photo.overall_rating} size="sm" />
                <span className="ml-0.5">{Number(photo.overall_rating).toFixed(1)}/10</span>
              </span>
            </div>
          </div>

          {/* Wing flavor + review text */}
          {(photo.wing_flavor || photo.review_text) && (
            <div className="px-4 py-2.5 border-b border-warmgray-100 space-y-1">
              {photo.wing_flavor && (
                <p className="text-xs font-medium text-charcoal-500">🍗 {photo.wing_flavor}</p>
              )}
              {photo.review_text && (
                <p className="text-sm text-charcoal-600 leading-relaxed italic">"{photo.review_text}"</p>
              )}
            </div>
          )}

          {/* Like bar */}
          <div className="px-4 py-2.5 border-b border-warmgray-100 flex items-center gap-3">
            <LikedByOverlay fetchUsers={fetchLikers} count={photo.like_count} label="Likes">
              <button
                onClick={onLike}
                className="flex items-center gap-1.5 group"
                aria-label={photo.is_liked_by_me ? 'Unlike' : 'Like'}
              >
                <HeartIcon
                  filled={photo.is_liked_by_me}
                  className={`w-5 h-5 transition-all duration-150 group-active:scale-125 ${
                    photo.is_liked_by_me ? 'text-amber-400' : 'text-charcoal-300 group-hover:text-amber-300'
                  }`}
                />
                <span className={`text-sm font-medium transition-colors ${
                  photo.is_liked_by_me ? 'text-amber-400' : 'text-charcoal-400'
                }`}>
                  {photo.like_count > 0
                    ? `${photo.like_count} ${photo.like_count === 1 ? 'like' : 'likes'}`
                    : 'Be the first to like'}
                </span>
              </button>
            </LikedByOverlay>
          </div>

          {/* Comment list — embedded */}
          <CommentSection
            embedded
            comments={interactions.comments}
            loading={interactions.loading}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onAdd={async opts => { await interactions.addComment(opts); onCommentAdded() }}
            onDelete={interactions.deleteComment}
            onToggleLike={interactions.toggleCommentLike}
            onToggleReaction={interactions.toggleReaction}
            onFetchReplies={interactions.fetchReplies}
            replyingTo={mobileReplyingTo}
            onSetReplyingTo={setMobileReplyingTo}
          />
        </div>

        {/* GIF picker overlay for mobile */}
        {mobileShowGif && (
          <div className="flex-shrink-0 border-t border-warmgray-100 px-3 py-2 max-h-[45dvh] overflow-hidden">
            <GifPicker
              onSelect={url => { setMobileSelectedGif(url); setMobileShowGif(false) }}
              onClose={() => setMobileShowGif(false)}
            />
          </div>
        )}

        {/* Reply context + GIF preview */}
        {(mobileReplyingTo || mobileSelectedGif) && (
          <div className="flex-shrink-0 border-t border-warmgray-100 px-4 py-2 bg-warmgray-50 flex items-center gap-2 flex-wrap">
            {mobileReplyingTo && (
              <span className="text-xs text-charcoal-500">
                Replying to <span className="font-semibold">{mobileReplyingTo.name}</span>
                <button
                  onClick={() => setMobileReplyingTo(null)}
                  className="ml-1.5 text-charcoal-300 hover:text-charcoal-500"
                >×</button>
              </span>
            )}
            {mobileSelectedGif && (
              <div className="relative">
                <img src={mobileSelectedGif} alt="GIF" className="h-12 rounded-md" />
                <button
                  onClick={() => setMobileSelectedGif(null)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-charcoal-700 text-white text-[10px] flex items-center justify-center"
                >×</button>
              </div>
            )}
          </div>
        )}

        {/* Sticky mobile input */}
        <div className="flex-shrink-0 border-t border-warmgray-100 px-4 py-3 flex items-end gap-2 bg-white">
          <button
            type="button"
            onClick={() => setMobileShowGif(prev => !prev)}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-colors ${
              mobileShowGif ? 'bg-amber-100 text-amber-600' : 'bg-warmgray-100 text-charcoal-500 hover:bg-warmgray-200'
            }`}
            title="GIF"
          >
            GIF
          </button>
          <textarea
            value={mobileText}
            onChange={e => setMobileText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleMobilePost()
              }
            }}
            placeholder={mobileReplyingTo ? `Reply to ${mobileReplyingTo.name}…` : 'Add a comment…'}
            maxLength={500}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-warmgray-300 bg-warmgray-50 px-3 py-2 text-base text-charcoal-700 placeholder:text-charcoal-300 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition-colors"
            style={{ maxHeight: '80px', overflowY: 'auto' }}
          />
          <button
            onClick={handleMobilePost}
            disabled={(!mobileText.trim() && !mobileSelectedGif) || mobilePosting}
            className="btn-primary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-40"
          >
            {mobilePosting ? '…' : 'Post'}
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (≥ 640px)
      ══════════════════════════════════════════════════════════════ */}
      <div
        className="hidden sm:flex sm:flex-row
                   bg-white w-full sm:max-w-3xl sm:rounded-3xl overflow-hidden shadow-2xl
                   sm:max-h-[86dvh] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: Photo */}
        <div
          className="sm:w-[46%] flex-shrink-0 bg-black flex items-center justify-center cursor-zoom-in"
          onClick={() => setShowLightbox(true)}
        >
          <img src={photo.photo_url} alt={photo.spot_name} className="w-full h-full object-cover" />
        </div>

        {/* Right: Details */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-warmgray-100 flex items-start justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-warmgray-200 flex-shrink-0 flex items-center justify-center">
                  {photo.reviewer_avatar ? (
                    <img src={photo.reviewer_avatar} alt={reviewerName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-charcoal-500">{reviewerName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-charcoal-700 truncate">{reviewerName}</p>
                  <p className="text-xs text-charcoal-300">{visitedDate}</p>
                </div>
              </div>
              <p className="font-display text-sm font-semibold text-charcoal-800 truncate">{photo.spot_name}</p>
              <p className="text-xs text-charcoal-400 truncate mt-0.5">{photo.spot_address}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="rating-wing text-xs">
                  🍗 <StarRating value={photo.overall_rating} size="sm" />
                  <span className="ml-0.5">{Number(photo.overall_rating).toFixed(1)}/10</span>
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-charcoal-400
                         hover:bg-warmgray-100 transition-colors text-lg leading-none flex-shrink-0 mt-0.5"
              aria-label="Close"
            >×</button>
          </div>

          {/* Wing flavor + review text */}
          {(photo.wing_flavor || photo.review_text) && (
            <div className="px-4 py-2.5 border-b border-warmgray-100 flex-shrink-0 space-y-1">
              {photo.wing_flavor && (
                <p className="text-xs font-medium text-charcoal-500">🍗 {photo.wing_flavor}</p>
              )}
              {photo.review_text && (
                <p className="text-sm text-charcoal-600 leading-relaxed italic break-words">"{photo.review_text}"</p>
              )}
            </div>
          )}

          {/* Like bar */}
          <div className="px-4 py-2.5 border-b border-warmgray-100 flex items-center gap-3 flex-shrink-0">
            <LikedByOverlay fetchUsers={fetchLikers} count={photo.like_count} label="Likes">
              <button
                onClick={onLike}
                className="flex items-center gap-1.5 group"
                aria-label={photo.is_liked_by_me ? 'Unlike' : 'Like'}
              >
                <HeartIcon
                  filled={photo.is_liked_by_me}
                  className={`w-5 h-5 transition-all duration-150 group-active:scale-125 ${
                    photo.is_liked_by_me ? 'text-amber-400' : 'text-charcoal-300 group-hover:text-amber-300'
                  }`}
                />
                <span className={`text-sm font-medium transition-colors ${
                  photo.is_liked_by_me ? 'text-amber-400' : 'text-charcoal-400'
                }`}>
                  {photo.like_count > 0
                    ? `${photo.like_count} ${photo.like_count === 1 ? 'like' : 'likes'}`
                    : 'Be the first to like'}
                </span>
              </button>
            </LikedByOverlay>
          </div>

          {/* Comments — standalone with scroll + input + GIF */}
          <div className="flex-1 min-h-0 flex flex-col">
            <CommentSection
              comments={interactions.comments}
              loading={interactions.loading}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onAdd={async opts => {
                await interactions.addComment(opts)
                onCommentAdded()
              }}
              onDelete={interactions.deleteComment}
              onToggleLike={interactions.toggleCommentLike}
              onToggleReaction={interactions.toggleReaction}
              onFetchReplies={interactions.fetchReplies}
            />
          </div>
        </div>
      </div>
      {showLightbox && (
        <div onClick={e => e.stopPropagation()}>
          <Lightbox
            photos={[{ id: photo.photo_id, url: photo.photo_url, review_id: '', storage_path: '', display_order: 0, created_at: '' }]}
            initialIndex={0}
            onClose={() => setShowLightbox(false)}
          />
        </div>
      )}
    </div>
  )
}
