import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import StarRating from '../ui/StarRating'
import ExpandableText from '../ui/ExpandableText'
import CommentSection from './CommentSection'
import HeartIcon from './HeartIcon'
import GifPicker from './GifPicker'
import { Lightbox } from '../ui/PhotoGallery'
import { useReviewComments } from '../../hooks/useReviewComments'
import { useAuthGate } from '../AuthGateModal'
import { useUserProfile } from '../UserProfileContext'
import LikedByOverlay from './LikedByOverlay'
import { fetchReviewLikers, fetchReviewCommentLikers, fetchReviewCommentReactors } from '../../lib/reactionDetails'
import type { GalleryPhoto, GalleryReviewItem } from '../../lib/types'

interface ReviewProps {
  review: GalleryReviewItem
  photo?: never
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onLike: () => void
  onCommentAdded: () => void
  onViewOnMap?: (spotId: string) => void
}

interface PhotoProps {
  photo: GalleryPhoto
  review?: never
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onLike: () => void
  onCommentAdded: () => void
  onViewOnMap?: (spotId: string) => void
}

type Props = ReviewProps | PhotoProps

export default function PhotoModal(props: Props) {
  const {
    currentUserId,
    isAdmin,
    onClose,
    onLike,
    onCommentAdded,
    onViewOnMap,
  } = props

  // Normalize: build a review-shaped object from either prop form
  const reviewData: GalleryReviewItem = props.review ?? {
    review_id: props.photo.review_id,
    overall_rating: props.photo.overall_rating,
    wing_flavor: props.photo.wing_flavor,
    review_text: props.photo.review_text,
    visited_at: props.photo.visited_at,
    wing_spot_id: props.photo.wing_spot_id,
    spot_name: props.photo.spot_name,
    spot_slug: props.photo.spot_slug,
    spot_address: props.photo.spot_address,
    reviewer_id: props.photo.reviewer_id,
    reviewer_name: props.photo.reviewer_name,
    reviewer_username: props.photo.reviewer_username,
    reviewer_avatar: props.photo.reviewer_avatar,
    reviewer_email: props.photo.reviewer_email,
    reviewer_is_private: props.photo.reviewer_is_private,
    like_count: props.photo.like_count,
    comment_count: props.photo.comment_count,
    is_liked_by_me: props.photo.is_liked_by_me,
    event_id: props.photo.event_id,
    event_slug: props.photo.event_slug,
    event_name: props.photo.event_name,
    photos: [{
      photo_id: props.photo.photo_id,
      photo_url: props.photo.photo_url,
      display_order: props.photo.display_order,
      photo_created_at: props.photo.photo_created_at,
    }],
  }

  const {
    comments,
    loading: commentsLoading,
    addComment,
    deleteComment,
    toggleCommentLike,
    toggleReaction,
    fetchReplies,
  } = useReviewComments(reviewData.review_id, currentUserId)
  const { requireAuth } = useAuthGate()
  const { openProfile } = useUserProfile()

  const [photoIndex, setPhotoIndex] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)

  // Mobile input state
  const [mobileText, setMobileText] = useState('')
  const [mobilePosting, setMobilePosting] = useState(false)
  const [mobileReplyingTo, setMobileReplyingTo] = useState<{ id: string; name: string } | null>(null)
  const [mobileShowGif, setMobileShowGif] = useState(false)
  const [mobileSelectedGif, setMobileSelectedGif] = useState<string | null>(null)

  // Clamp photo index when photos change
  useEffect(() => {
    if (photoIndex >= reviewData.photos.length) {
      setPhotoIndex(Math.max(0, reviewData.photos.length - 1))
    }
  }, [reviewData.photos.length, photoIndex])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showLightbox) onClose() }
    document.addEventListener('keydown', handler)

    // iOS-safe scroll lock — pin body so closing doesn't jump to top.
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [onClose, showLightbox])

  const handleMobilePost = async () => {
    if ((!mobileText.trim() && !mobileSelectedGif) || mobilePosting) return
    if (!requireAuth()) return
    setMobilePosting(true)
    await addComment({
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

  const currentPhoto = reviewData.photos[photoIndex] ?? reviewData.photos[0]

  const visitedDate = (() => {
    try { return format(new Date(reviewData.visited_at), 'MMM d, yyyy') }
    catch { return reviewData.visited_at }
  })()

  const reviewerName = reviewData.reviewer_name ?? reviewData.reviewer_email?.split('@')[0] ?? 'Unknown'

  const fetchLikers = useCallback(() => fetchReviewLikers(reviewData.review_id), [reviewData.review_id])

  const goToPrev = () => setPhotoIndex(i => Math.max(0, i - 1))
  const goToNext = () => setPhotoIndex(i => Math.min(reviewData.photos.length - 1, i + 1))

  const photoCarousel = (
    <div className="relative w-full bg-warmgray-100 aspect-video overflow-hidden">
      <img
        src={currentPhoto.photo_url}
        alt={reviewData.spot_name}
        className="w-full h-full object-cover cursor-zoom-in"
        onClick={() => setShowLightbox(true)}
      />
      {reviewData.photos.length > 1 && (
        <>
          {photoIndex > 0 && (
            <button
              onClick={goToPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-night-900/45 backdrop-blur-sm text-cream-50 flex items-center justify-center hover:bg-night-900/65 transition-colors"
              aria-label="Previous photo"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          {photoIndex < reviewData.photos.length - 1 && (
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-night-900/45 backdrop-blur-sm text-cream-50 flex items-center justify-center hover:bg-night-900/65 transition-colors"
              aria-label="Next photo"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
            {reviewData.photos.map((_, i) => (
              <button
                key={i}
                onClick={() => setPhotoIndex(i)}
                className="w-6 h-6 flex items-center justify-center"
                aria-label={`Photo ${i + 1}`}
              >
                <span className={`block rounded-full transition-all ${
                  i === photoIndex ? 'bg-cream-50 w-2.5 h-2.5 shadow' : 'bg-cream-50/55 w-1.5 h-1.5'
                }`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  const reviewerHeader = (
    <button
      type="button"
      onClick={() => openProfile(reviewData.reviewer_id)}
      className="flex items-center gap-2 mb-2 group text-left hover:opacity-80 transition-opacity"
    >
      <div className="w-7 h-7 rounded-full overflow-hidden bg-warmgray-200 flex-shrink-0 flex items-center justify-center">
        {reviewData.reviewer_avatar ? (
          <img src={reviewData.reviewer_avatar} alt={reviewerName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-charcoal-500">{reviewerName.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-charcoal-700 truncate group-hover:text-sauce-500 transition-colors">{reviewerName}</p>
        <p className="text-xs text-charcoal-300">{visitedDate}</p>
      </div>
    </button>
  )

  const ratingsRow = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="rating-wing text-xs">
        🍗 <StarRating value={reviewData.overall_rating} size="sm" />
        <span className="ml-0.5">{reviewData.overall_rating.toFixed(1)}</span>
      </span>
    </div>
  )

  const likeBar = (
    <div className="px-4 py-2.5 border-b border-warmgray-100 flex items-center gap-3">
      <LikedByOverlay fetchUsers={fetchLikers} count={reviewData.like_count} label="Likes">
        <button
          onClick={() => { if (requireAuth()) onLike() }}
          className="flex items-center gap-1.5 group"
          aria-label={reviewData.is_liked_by_me ? 'Unlike' : 'Like'}
        >
          <HeartIcon
            filled={reviewData.is_liked_by_me}
            className={`w-5 h-5 transition-all duration-150 group-active:scale-125 ${
              reviewData.is_liked_by_me ? 'text-amber-400' : 'text-charcoal-300 group-hover:text-amber-300'
            }`}
          />
          <span className={`text-sm font-medium transition-colors ${
            reviewData.is_liked_by_me ? 'text-amber-400' : 'text-charcoal-400'
          }`}>
            {reviewData.like_count > 0
              ? `${reviewData.like_count} ${reviewData.like_count === 1 ? 'like' : 'likes'}`
              : 'Be the first to like'}
          </span>
        </button>
      </LikedByOverlay>
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >

      {/* MOBILE LAYOUT (< 640px) */}
      <div
        className="sm:hidden bg-cream-50 w-full rounded-t-3xl shadow-2xl animate-slide-up
                   h-[100dvh] sm:h-[92dvh] flex flex-col overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-warmgray-100">
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-charcoal-800 truncate">{reviewData.spot_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <p className="text-xs text-charcoal-400 truncate">{reviewData.spot_address}</p>
              {onViewOnMap && (
                <button
                  onClick={() => onViewOnMap(reviewData.wing_spot_id)}
                  className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-500 font-medium transition-colors"
                  aria-label="View on map"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Map
                </button>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-charcoal-400
                       hover:bg-warmgray-100 transition-colors text-lg leading-none flex-shrink-0"
            aria-label="Close"
          >×</button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {photoCarousel}

          <div className="px-4 pt-3 pb-3 border-b border-warmgray-100">
            {reviewerHeader}
            {ratingsRow}
          </div>

          {(reviewData.wing_flavor || reviewData.review_text) && (
            <div className="px-4 py-2.5 border-b border-warmgray-100 space-y-1">
              {reviewData.wing_flavor && (
                <p className="text-xs font-medium text-charcoal-500">🌶️ {reviewData.wing_flavor}</p>
              )}
              {reviewData.review_text && (
                <ExpandableText text={reviewData.review_text} />
              )}
            </div>
          )}

          {likeBar}

          <CommentSection
            embedded
            comments={comments}
            loading={commentsLoading}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            requireAuth={requireAuth}
            onAdd={async opts => { await addComment(opts); onCommentAdded() }}
            onDelete={deleteComment}
            onToggleLike={toggleCommentLike}
            onToggleReaction={toggleReaction}
            onFetchReplies={fetchReplies}
            likersFetcher={fetchReviewCommentLikers}
            reactorsFetcher={fetchReviewCommentReactors}
            replyingTo={mobileReplyingTo}
            onSetReplyingTo={setMobileReplyingTo}
          />
        </div>

        {mobileShowGif && (
          <div className="flex-shrink-0 border-t border-warmgray-100 px-3 py-2 max-h-[45dvh] overflow-hidden">
            <GifPicker
              onSelect={url => { setMobileSelectedGif(url); setMobileShowGif(false) }}
              onClose={() => setMobileShowGif(false)}
            />
          </div>
        )}

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

        <div
          className="flex-shrink-0 border-t border-night-900/10 px-3 py-2.5 flex items-end gap-2 bg-cream-50"
          style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => { if (requireAuth()) setMobileShowGif(prev => !prev) }}
            className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xs font-extrabold uppercase tracking-crowd transition-colors ${
              mobileShowGif ? 'bg-sauce-100 text-sauce-600' : 'bg-cream-100 text-charcoal-500 hover:bg-cream-200'
            }`}
            title="GIF"
            aria-label="Add a GIF"
          >
            GIF
          </button>
          <textarea
            value={mobileText}
            onChange={e => setMobileText(e.target.value)}
            onFocus={e => { if (!requireAuth()) e.target.blur() }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleMobilePost()
              }
            }}
            placeholder={mobileReplyingTo ? `Reply to ${mobileReplyingTo.name}…` : 'Add a comment…'}
            maxLength={500}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-night-900/15 bg-cream-100 px-3 py-2.5 text-base text-night-800 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sauce-300 focus:border-night-900/30 transition-colors"
            style={{ maxHeight: '96px', minHeight: '44px', overflowY: 'auto' }}
          />
          <button
            onClick={handleMobilePost}
            disabled={(!mobileText.trim() && !mobileSelectedGif) || mobilePosting}
            className="btn-primary px-4 min-h-[44px] text-sm flex-shrink-0 disabled:opacity-40"
          >
            {mobilePosting ? '…' : 'Post'}
          </button>
        </div>
      </div>

      {/* DESKTOP LAYOUT (≥ 640px) */}
      <div
        className="hidden sm:flex sm:flex-row
                   bg-white w-full sm:max-w-3xl sm:rounded-3xl overflow-hidden shadow-2xl
                   sm:max-h-[86dvh] animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:w-[46%] flex-shrink-0 bg-black flex items-center justify-center relative">
          <img
            src={currentPhoto.photo_url}
            alt={reviewData.spot_name}
            className="w-full h-full object-cover cursor-zoom-in"
            onClick={() => setShowLightbox(true)}
          />
          {reviewData.photos.length > 1 && (
            <>
              {photoIndex > 0 && (
                <button
                  onClick={goToPrev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-night-900/45 backdrop-blur-sm text-cream-50 flex items-center justify-center hover:bg-night-900/65 transition-colors"
                  aria-label="Previous photo"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
              )}
              {photoIndex < reviewData.photos.length - 1 && (
                <button
                  onClick={goToNext}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-night-900/45 backdrop-blur-sm text-cream-50 flex items-center justify-center hover:bg-night-900/65 transition-colors"
                  aria-label="Next photo"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              )}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1">
                {reviewData.photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className="w-6 h-6 flex items-center justify-center"
                    aria-label={`Photo ${i + 1}`}
                  >
                    <span className={`block rounded-full transition-all ${
                      i === photoIndex ? 'bg-cream-50 w-2.5 h-2.5 shadow' : 'bg-cream-50/55 w-1.5 h-1.5'
                    }`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="px-4 pt-4 pb-3 border-b border-warmgray-100 flex items-start justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
              {reviewerHeader}
              <p className="font-display text-sm font-semibold text-charcoal-800 truncate">{reviewData.spot_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <p className="text-xs text-charcoal-400 truncate">{reviewData.spot_address}</p>
                {onViewOnMap && (
                  <button
                    onClick={() => onViewOnMap(reviewData.wing_spot_id)}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-500 font-medium transition-colors"
                    aria-label="View on map"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    Map
                  </button>
                )}
              </div>
              <div className="mt-2">
                {ratingsRow}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center text-charcoal-400
                         hover:bg-warmgray-100 transition-colors text-lg leading-none flex-shrink-0 mt-0.5"
              aria-label="Close"
            >×</button>
          </div>

          {(reviewData.wing_flavor || reviewData.review_text) && (
            <div className="px-4 py-2.5 border-b border-warmgray-100 flex-shrink-0 space-y-1">
              {reviewData.wing_flavor && (
                <p className="text-xs font-medium text-charcoal-500">🌶️ {reviewData.wing_flavor}</p>
              )}
              {reviewData.review_text && (
                <ExpandableText text={reviewData.review_text} />
              )}
            </div>
          )}

          <div className="flex-shrink-0">
            {likeBar}
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <CommentSection
              comments={comments}
              loading={commentsLoading}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              requireAuth={requireAuth}
              onAdd={async opts => {
                await addComment(opts)
                onCommentAdded()
              }}
              onDelete={deleteComment}
              onToggleLike={toggleCommentLike}
              onToggleReaction={toggleReaction}
              onFetchReplies={fetchReplies}
              likersFetcher={fetchReviewCommentLikers}
              reactorsFetcher={fetchReviewCommentReactors}
            />
          </div>
        </div>
      </div>
      {showLightbox && (
        <div onClick={e => e.stopPropagation()}>
          <Lightbox
            photos={reviewData.photos.map(p => ({
              id: p.photo_id,
              url: p.photo_url,
              review_id: reviewData.review_id,
              storage_path: '',
              display_order: p.display_order,
              created_at: p.photo_created_at,
            }))}
            initialIndex={photoIndex}
            onClose={() => setShowLightbox(false)}
          />
        </div>
      )}
    </div>
  )
}
