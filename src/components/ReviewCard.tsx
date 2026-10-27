import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import StarRating from './ui/StarRating'
import ExpandableText from './ui/ExpandableText'
import AvatarImage from './ui/AvatarImage'
import ReviewEditModal from './ReviewEditModal'
import ReviewCommentThread from './ReviewCommentThread'
import ReactionPicker from './gallery/ReactionPicker'
import LikedByOverlay from './gallery/LikedByOverlay'
import Modal from './ui/Modal'
import { useReviewReactions } from '../hooks/useReviewReactions'
import { useAuthGate } from './AuthGateModal'
import { fetchReviewReactors } from '../lib/reactionDetails'
import { supabase } from '../lib/supabase'
import { formatVisitDate } from '../lib/dates'
import type { Review, ReviewUpdateData } from '../lib/types'

const UNDO_WINDOW_MS = 5000
const REPORT_EMAIL = 'anthonycap949@gmail.com'

interface Props {
  review: Review
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  compact?: boolean
  /** Real comment count (top-level + replies). When omitted the card
   *  fetches it itself so the label never claims "0 comments" falsely. */
  commentCount?: number
}

export default function ReviewCard({
  review,
  currentUserId,
  isAdmin,
  onUpdate,
  onDelete,
  compact = false,
  commentCount,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [localCommentCount, setLocalCommentCount] = useState(commentCount ?? 0)

  // The parent's count can arrive after mount (pages fetch it alongside the
  // reviews), so keep following the prop instead of freezing the first value.
  useEffect(() => {
    if (commentCount !== undefined) setLocalCommentCount(commentCount)
  }, [commentCount])

  // No count from the parent: ask for it (head-only count, no rows).
  useEffect(() => {
    if (commentCount !== undefined) return
    let cancelled = false
    supabase
      .from('review_comments')
      .select('id', { count: 'exact', head: true })
      .eq('review_id', review.id)
      .then(({ count, error }) => {
        if (!cancelled && !error && count != null) setLocalCommentCount(count)
      })
    return () => { cancelled = true }
  }, [commentCount, review.id])

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
  const visitedDate = formatVisitDate(review.visited_at)

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
        {/* Identity + rating header */}
        <div className="flex items-center gap-2 mb-2 flex-wrap min-w-0">
          {(() => {
            const isPrivate = review.reviewer_is_private === true
            const displayName = isPrivate ? 'Private' : (review.reviewer_name ?? review.reviewer_email ?? 'Unknown')
            const avatar = isPrivate ? null : review.reviewer_avatar
            const linkable = !isPrivate && review.reviewer_username
            const chip = (
              <>
                <AvatarImage
                  src={avatar}
                  alt={displayName}
                  className="w-6 h-6 flex-shrink-0 rounded-full object-cover border border-night-900"
                  fallback={
                    <span className="w-6 h-6 flex-shrink-0 rounded-full bg-night-800 text-cream-50 flex items-center justify-center text-[10px] font-extrabold uppercase border border-night-900">
                      {displayName.charAt(0)}
                    </span>
                  }
                />
                <span className="min-w-0 truncate text-[11px] font-extrabold uppercase tracking-crowd text-night-800">
                  {displayName}
                </span>
              </>
            )
            return linkable ? (
              <Link to={`/u/${review.reviewer_username}`} className="inline-flex items-center gap-2 min-w-0 max-w-full hover:text-sauce-500 transition-colors">
                {chip}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 min-w-0 max-w-full">{chip}</span>
            )
          })()}
          <span className="text-[11px] text-charcoal-500 font-medium">{visitedDate}</span>
          <span className="rating-wing ml-auto">
            🍗 <StarRating value={review.overall_rating} size="sm" /> {review.overall_rating.toFixed(1)}
          </span>
          {review.event_id && review.event_name && (
            review.event_slug ? (
              <Link
                to={`/events/${review.event_slug}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-2 border-night-900 bg-gold-300 text-night-900 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm max-w-full min-w-0 hover:bg-gold-200 transition-colors"
              >
                🏆 <span className="truncate">{review.event_name}</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-2 border-night-900 bg-gold-300 text-night-900 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm max-w-full min-w-0">
                🏆 <span className="truncate">{review.event_name}</span>
              </span>
            )
          )}
        </div>

        {/* Wing flavor + size */}
        {(review.wing_flavor || review.wing_size) && (
          <p className="mb-2 flex items-baseline flex-wrap gap-x-4 gap-y-1 max-w-full">
            {review.wing_flavor && (
              <span className="flex items-baseline gap-1.5 min-w-0 max-w-full">
                <span className="eyebrow text-night-700 flex-shrink-0">Flavor</span>
                <span className="text-sm font-bold text-night-900 min-w-0 break-words [overflow-wrap:anywhere]">{review.wing_flavor}</span>
              </span>
            )}
            {review.wing_size && (
              <span className="flex items-baseline gap-1.5">
                <span className="eyebrow text-night-700 flex-shrink-0">Wing size</span>
                <span className="text-sm font-bold text-night-900 capitalize">{review.wing_size}</span>
              </span>
            )}
          </p>
        )}

        {/* Review text */}
        {review.review_text && (
          <ExpandableText text={review.review_text} className="mb-2 text-charcoal-700 leading-relaxed" />
        )}

        {/* Footer: comments + options */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {/* Comment toggle — icon + visible text, 44px tall hit area */}
          <button
            onClick={() => setShowComments(!showComments)}
            aria-expanded={showComments}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-1 -mx-1 text-charcoal-500 hover:text-sauce-500 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-xs font-bold">
              {localCommentCount > 0
                ? `${localCommentCount} comment${localCommentCount !== 1 ? 's' : ''}`
                : 'Comment'}
            </span>
          </button>

          {/* Edit/Delete — behind a muted kebab, requires deliberate tap */}
          {canEdit && (
            <div ref={menuRef} className="relative ml-auto">
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Review options"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="min-h-[44px] min-w-[44px] px-2 inline-flex items-center justify-center gap-1 rounded-lg text-charcoal-500 hover:text-night-800 hover:bg-cream-100 active:bg-cream-200 transition-colors leading-none"
              >
                <span aria-hidden="true" className="text-base">···</span>
                <span className="text-xs font-bold">Options</span>
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
          {/* Moderation is by email to the admin (see Terms) */}
          {!canEdit && (
            <a
              href={`mailto:${REPORT_EMAIL}?subject=${encodeURIComponent('Report a review')}&body=${encodeURIComponent(`Review: ${window.location.origin}/reviews/${review.id}\n\nWhat's wrong with it:\n`)}`}
              className="ml-auto min-h-[44px] px-2 inline-flex items-center text-xs font-bold text-charcoal-400 hover:text-sauce-600 transition-colors"
            >
              Report
            </a>
          )}
        </div>

        {/* Reactions */}
        <div className="mt-3 group">
          <LikedByOverlay fetchUsers={() => fetchReviewReactors(review.id)} count={totalReactionCount} label="Reactions">
            <ReactionPicker
              reactions={reactions}
              onToggle={type => { if (requireAuth()) toggleReaction(type) }}
              showLabel
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
              You're about to delete your review from <span className="font-bold">{visitedDate}</span>.
              {' '}Its photos and comments will be removed too.
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
