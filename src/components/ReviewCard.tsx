import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import StarRating from './ui/StarRating'
import ExpandableText from './ui/ExpandableText'
import ReviewEditModal from './ReviewEditModal'
import ReviewCommentThread from './ReviewCommentThread'
import ReactionPicker from './gallery/ReactionPicker'
import LikedByOverlay from './gallery/LikedByOverlay'
import Modal from './ui/Modal'
import { useReviewReactions } from '../hooks/useReviewReactions'
import { useAuthGate } from './AuthGateModal'
import { fetchReviewReactors } from '../lib/reactionDetails'
import type { Review, ReviewUpdateData } from '../lib/types'

const UNDO_WINDOW_MS = 5000

interface Props {
  review: Review
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  compact?: boolean
  commentCount?: number
}

export default function ReviewCard({
  review,
  currentUserId,
  isAdmin,
  onUpdate,
  onDelete,
  compact = false,
  commentCount = 0,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [localCommentCount, setLocalCommentCount] = useState(commentCount)

  // Deferred-delete window: the card stays mounted as an "Undo" stub for
  // UNDO_WINDOW_MS; only after that does the real delete fire.
  const [pendingDelete, setPendingDelete] = useState(false)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleanupTimer = () => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = null
    }
  }
  const onDeleteRef = useRef(onDelete)
  onDeleteRef.current = onDelete
  // Unmounting mid-countdown must flush the promised delete, not drop it —
  // otherwise "Review deleted" was a lie and the review silently survives.
  useEffect(() => () => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current)
      deleteTimerRef.current = null
      onDeleteRef.current(review.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close kebab menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const { requireAuth } = useAuthGate()
  const { reactions, toggleReaction } = useReviewReactions(review.id, currentUserId)
  const totalReactionCount = reactions.reduce((sum, r) => sum + r.count, 0)

  const canEdit = isAdmin || review.user_id === currentUserId
  const visitedDate = (() => {
    try { return format(new Date(review.visited_at), 'MMM d, yyyy') }
    catch { return review.visited_at }
  })()

  const undoDelete = () => {
    cleanupTimer()
    setPendingDelete(false)
  }

  const startDelete = () => {
    setConfirmDelete(false)
    setPendingDelete(true)
    deleteTimerRef.current = setTimeout(async () => {
      deleteTimerRef.current = null
      const { error } = await onDelete(review.id)
      if (error) {
        setPendingDelete(false)
        toast.error('Could not delete review')
      }
    }, UNDO_WINDOW_MS)
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span>Review deleted</span>
          <button
            onClick={() => { undoDelete(); toast.dismiss(t.id) }}
            className="font-extrabold uppercase tracking-crowd text-sauce-300 hover:text-sauce-200"
          >
            Undo
          </button>
        </span>
      ),
      { duration: UNDO_WINDOW_MS, id: `undo-delete-${review.id}` }
    )
  }

  if (pendingDelete) {
    return (
      <div id={`review-${review.id}`} className={`${compact ? 'py-3' : 'py-4'} animate-fade-in`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-night-900/30 bg-cream-100">
          <span className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-600">
            Review deleted
          </span>
          <button
            onClick={undoDelete}
            className="text-xs font-extrabold uppercase tracking-crowd text-sauce-600 hover:text-sauce-700"
          >
            Undo
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div id={`review-${review.id}`} className={`${compact ? 'py-3' : 'py-4'} animate-fade-in transition-shadow duration-300`}>
        {/* Ratings row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="rating-wing">
            🍗 <StarRating value={review.overall_rating} size="sm" /> {review.overall_rating.toFixed(1)}
          </span>
          {review.event_id && review.event_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-2 border-night-900 bg-gold-300 text-night-900 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm">
              🏆 {review.event_name}
            </span>
          )}
        </div>

        {/* Wing flavor */}
        {review.wing_flavor && (
          <p className="mb-2 inline-flex items-center gap-1.5">
            <span className="eyebrow text-night-700">Flavor</span>
            <span className="text-sm font-bold text-night-900">{review.wing_flavor}</span>
          </p>
        )}

        {/* Review text */}
        {review.review_text && (
          <ExpandableText text={review.review_text} className="mb-2 text-charcoal-700 leading-relaxed" />
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {(() => {
            const isPrivate = review.reviewer_is_private === true
            const displayName = isPrivate ? 'Private' : (review.reviewer_name ?? review.reviewer_email ?? 'Unknown')
            const avatar = isPrivate ? null : review.reviewer_avatar
            const linkable = !isPrivate && review.reviewer_username
            const chip = (
              <>
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName}
                    className="w-5 h-5 rounded-full object-cover border border-night-900"
                  />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-night-800 text-cream-50 flex items-center justify-center text-[10px] font-extrabold uppercase border border-night-900">
                    {displayName.charAt(0)}
                  </span>
                )}
                <span className="font-extrabold uppercase tracking-crowd text-night-800">
                  {displayName}
                </span>
              </>
            )
            return linkable ? (
              <Link to={`/u/${review.reviewer_username}`} className="inline-flex items-center gap-2 hover:text-sauce-500 transition-colors">
                {chip}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2">{chip}</span>
            )
          })()}
          <span className="text-charcoal-400">·</span>
          <span className="text-charcoal-500 font-medium">{visitedDate}</span>

          <span className="text-charcoal-400">·</span>

          {/* Comment toggle — icon + count only, no text label */}
          <button
            onClick={() => setShowComments(!showComments)}
            aria-label={`${localCommentCount} comment${localCommentCount !== 1 ? 's' : ''}`}
            className="inline-flex items-center gap-1 min-h-[32px] px-1 -mx-1 text-charcoal-500 hover:text-sauce-500 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {localCommentCount > 0 && (
              <span className="text-[11px] font-bold">{localCommentCount}</span>
            )}
          </button>

          {/* Edit/Delete — behind a muted kebab, requires deliberate tap */}
          {canEdit && (
            <div ref={menuRef} className="relative ml-auto">
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Review options"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-charcoal-500 hover:text-night-800 hover:bg-cream-100 active:bg-cream-200 transition-colors text-base leading-none"
              >
                ···
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 bottom-full mb-1 w-32 bg-cream-50 border-2 border-night-900 rounded-lg shadow-sticker overflow-hidden z-20 animate-fade-in">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setEditing(true) }}
                    className="w-full px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-crowd text-night-800 hover:bg-cream-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
                    className="w-full px-3 py-2.5 text-left text-xs font-extrabold uppercase tracking-crowd text-sauce-600 hover:bg-sauce-50 transition-colors border-t border-night-900/15"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reactions */}
        <div className="mt-3 group">
          <LikedByOverlay fetchUsers={() => fetchReviewReactors(review.id)} count={totalReactionCount} label="Reactions">
            <ReactionPicker
              reactions={reactions}
              onToggle={type => { if (requireAuth()) toggleReaction(type) }}
            />
          </LikedByOverlay>
        </div>

        {showComments && (
          <div className="mt-3 border-t-2 border-night-900/10 pt-3">
            <ReviewCommentThread
              reviewId={review.id}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onCommentCountChange={setLocalCommentCount}
              autoFocus
            />
          </div>
        )}
      </div>

      {editing && (
        <ReviewEditModal
          review={review}
          onClose={() => setEditing(false)}
          onSubmit={async (data) => {
            const result = await onUpdate(review.id, data)
            if (!result.error) {
              setEditing(false)
              toast.success('Review updated')
            } else {
              toast.error(result.error)
            }
          }}
        />
      )}

      {confirmDelete && (
        <Modal title="Delete this review?" onClose={() => setConfirmDelete(false)} size="sm">
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-charcoal-700 leading-relaxed">
              You're about to delete your review
              {review.wing_flavor ? <> of <span className="font-bold">{review.wing_flavor}</span></> : null}
              {' '}from <span className="font-bold">{visitedDate}</span>. Photos and comments will be removed.
            </p>
            <p className="text-xs text-charcoal-500">
              You'll have {Math.round(UNDO_WINDOW_MS / 1000)} seconds to undo.
            </p>
            <div className="flex gap-3 pt-1 pb-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startDelete}
                className="btn-primary flex-1 bg-sauce-500 hover:bg-sauce-400"
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
