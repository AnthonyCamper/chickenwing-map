import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Comment, AddCommentOptions } from '../../lib/types'
import type { ReactionUser } from '../../lib/reactionDetails'
import HeartIcon from './HeartIcon'
import ReactionPicker from './ReactionPicker'
import GifPicker from './GifPicker'
import LikedByOverlay from './LikedByOverlay'
import CommentComposer, { commentTooLong, replyPlaceholder } from './CommentComposer'
import AvatarImage from '../ui/AvatarImage'
import { cleanUserText } from '../../lib/userText'
import { fetchReviewCommentLikers, fetchReviewCommentReactors } from '../../lib/reactionDetails'

type UserFetcher = (id: string) => Promise<ReactionUser[]>

/** How long a comment opened from a notification stays highlighted. */
const HIGHLIGHT_MS = 2500

interface Props {
  comments: Comment[]
  loading: boolean
  currentUserId: string
  isAdmin: boolean
  requireAuth?: () => boolean
  onAdd: (opts: string | AddCommentOptions) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  onToggleLike: (commentId: string) => Promise<void>
  onToggleReaction: (commentId: string, reactionType: string) => Promise<void>
  onFetchReplies: (parentId: string) => Promise<Comment[]>
  /** Override the default likers fetcher. */
  likersFetcher?: UserFetcher
  /** Override the default reactors fetcher. */
  reactorsFetcher?: UserFetcher
  /**
   * Embedded mode: renders only the comment list items without a scroll
   * wrapper or input bar. Used in the mobile single-scroll layout.
   */
  embedded?: boolean
  /** External reply state — used by PhotoModal to control the anchored input */
  replyingTo?: { id: string; name: string } | null
  onSetReplyingTo?: (target: { id: string; name: string } | null) => void
  /** Focus the input textarea on mount (non-embedded mode only). */
  autoFocus?: boolean
  /**
   * Bring one comment into view (notification deep link): its reply thread
   * is expanded, it is scrolled to the middle of the screen and briefly
   * highlighted. `focusParentId` is the top-level comment when it's a reply.
   * Change `focusKey` to repeat the same request.
   */
  focusCommentId?: string | null
  focusParentId?: string | null
  focusKey?: string
  /** Re-fetch the comments (the focused one may be newer than the list). */
  onRefresh?: () => Promise<void> | void
}

export default function CommentSection({
  comments,
  loading,
  currentUserId,
  isAdmin,
  requireAuth,
  onAdd,
  onDelete,
  onToggleLike,
  onToggleReaction,
  onFetchReplies,
  likersFetcher,
  reactorsFetcher,
  embedded = false,
  replyingTo: externalReplyingTo,
  onSetReplyingTo,
  autoFocus = false,
  focusCommentId = null,
  focusParentId = null,
  focusKey,
  onRefresh,
}: Props) {
  const getLikers = likersFetcher ?? fetchReviewCommentLikers
  const getReactors = reactorsFetcher ?? fetchReviewCommentReactors
  const gate = requireAuth ?? (() => true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [selectedGif, setSelectedGif] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Which top-level comments have their replies open. Lives here (not in
  // each thread) so a notification deep link or your own new reply can open
  // the right thread.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [loadingThread, setLoadingThread] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  // Internal reply state (standalone mode)
  const [internalReplyingTo, setInternalReplyingTo] = useState<{ id: string; name: string } | null>(null)

  // Auto-focus when requested (after mount, only in standalone mode).
  useEffect(() => {
    if (autoFocus && !embedded) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [autoFocus, embedded])
  const replyingTo = externalReplyingTo !== undefined ? externalReplyingTo : internalReplyingTo
  const setReplyingTo = onSetReplyingTo ?? setInternalReplyingTo

  const openThread = useCallback(async (parentId: string) => {
    setLoadingThread(parentId)
    try {
      await onFetchReplies(parentId)
      setExpanded(prev => new Set(prev).add(parentId))
    } finally {
      setLoadingThread(cur => (cur === parentId ? null : cur))
    }
  }, [onFetchReplies])

  const toggleThread = useCallback((parentId: string) => {
    if (expanded.has(parentId)) {
      setExpanded(prev => {
        const next = new Set(prev)
        next.delete(parentId)
        return next
      })
      return
    }
    openThread(parentId)
  }, [expanded, openThread])

  // A reply you just posted (still "temp-…") must stay visible: open its
  // thread instead of hiding it behind "View 1 reply". Covers every composer,
  // including PhotoModal's own pinned one.
  useEffect(() => {
    const withNewReply = comments.filter(
      c => !expanded.has(c.id) && c.replies?.some(r => r.id.startsWith('temp-'))
    )
    if (withNewReply.length === 0) return
    setExpanded(prev => {
      const next = new Set(prev)
      withNewReply.forEach(c => next.add(c.id))
      return next
    })
  }, [comments, expanded])

  // ── Notification deep link: open, scroll to and highlight one comment ──
  const focusDoneRef = useRef<string | null>(null)
  const focusRefreshedRef = useRef<string | null>(null)
  const focusToken = focusCommentId ? `${focusCommentId}|${focusKey ?? ''}` : null

  useEffect(() => {
    if (!focusToken || !focusCommentId || loading) return
    if (focusDoneRef.current === focusToken) return

    const threadId = focusParentId ?? focusCommentId
    const thread = comments.find(c => c.id === threadId)
    if (!thread) {
      // Newer than the loaded list → fetch once; otherwise it was deleted.
      if (onRefresh && focusRefreshedRef.current !== focusToken) {
        focusRefreshedRef.current = focusToken
        onRefresh()
      } else {
        focusDoneRef.current = focusToken
      }
      return
    }
    if (focusParentId && !expanded.has(focusParentId)) {
      if (loadingThread !== focusParentId) openThread(focusParentId)
      return
    }

    const el = document.getElementById(`comment-${focusCommentId}`)
    if (!el) {
      // Thread is open but the reply itself is gone (deleted): stop here.
      focusDoneRef.current = focusToken
      return
    }
    focusDoneRef.current = focusToken
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // 'center' keeps it clear of the sticky header and the floating button.
    el.scrollIntoView?.({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
    setHighlightId(focusCommentId)
  }, [focusToken, focusCommentId, focusParentId, comments, loading, expanded, loadingThread, openThread, onRefresh])

  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    return () => clearTimeout(t)
  }, [highlightId])

  const handlePost = async () => {
    if ((!text.trim() && !selectedGif) || posting || commentTooLong(text)) return
    if (!gate()) return
    setPosting(true)
    const threadId = replyingTo?.id ?? null
    await onAdd({
      text: text.trim() || undefined,
      parentCommentId: threadId,
      mediaUrl: selectedGif ?? undefined,
      contentType: selectedGif && text.trim() ? 'mixed' : selectedGif ? 'gif' : 'text',
    })
    // Keep the thread you just replied in open so your reply stays visible.
    if (threadId) setExpanded(prev => new Set(prev).add(threadId))
    setText('')
    setSelectedGif(null)
    setReplyingTo(null)
    setShowGifPicker(false)
    setPosting(false)
  }

  const handleReply = (comment: Comment) => {
    if (!gate()) return
    const name = cleanUserText(comment.commenter_name ?? comment.commenter_email?.split('@')[0] ?? 'Unknown')
    setReplyingTo({ id: comment.parent_comment_id ?? comment.id, name })
    setShowGifPicker(false)
    inputRef.current?.focus()
  }

  const handleGifSelect = (url: string) => {
    setSelectedGif(url)
    setShowGifPicker(false)
  }

  const cancelReply = () => {
    setReplyingTo(null)
  }

  const commentList = (
    <div className="px-4 py-3 space-y-4">
      {loading && (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 rounded-full border-2 border-cream-200 border-t-sauce-400 animate-spin" />
        </div>
      )}
      {!loading && comments.length === 0 && (
        <p className="text-center text-xs text-charcoal-400 py-6">
          No comments yet. Be the first to comment.
        </p>
      )}
      {comments.map(comment => (
        <CommentThread
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          requireAuth={gate}
          onDelete={onDelete}
          onToggleLike={onToggleLike}
          onToggleReaction={onToggleReaction}
          onReply={handleReply}
          showReplies={expanded.has(comment.id)}
          loadingReplies={loadingThread === comment.id}
          onToggleReplies={() => toggleThread(comment.id)}
          highlightId={highlightId}
          getLikers={getLikers}
          getReactors={getReactors}
        />
      ))}
    </div>
  )

  // ── Embedded mode ──────────────────────────────────────────────────────────
  if (embedded) return commentList

  // ── Standalone mode (desktop) ─────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        {commentList}
      </div>

      {/* GIF picker */}
      {showGifPicker && (
        <div className="flex-shrink-0 border-t border-night-900/10 px-3 py-2">
          <GifPicker
            onSelect={handleGifSelect}
            onClose={() => setShowGifPicker(false)}
          />
        </div>
      )}

      {/* Reply context + GIF preview */}
      {(replyingTo || selectedGif) && (
        <div className="flex-shrink-0 border-t border-night-900/10 px-4 py-2 bg-cream-100 flex items-center gap-2 flex-wrap">
          {replyingTo && (
            <span className="text-xs text-charcoal-600 min-w-0">
              Replying to <span className="font-bold text-night-800 user-text">{replyingTo.name}</span>
              <button
                onClick={cancelReply}
                className="ml-1 inline-flex items-center justify-center w-11 h-11 -my-3.5 align-middle rounded-full text-charcoal-400 hover:bg-cream-200 hover:text-night-800"
                aria-label="Cancel reply"
              >×</button>
            </span>
          )}
          {selectedGif && (
            <div className="relative">
              <img src={selectedGif} alt="Chosen GIF" className="h-12 rounded-md" />
              <button
                onClick={() => setSelectedGif(null)}
                className="absolute -top-3.5 -right-3.5 w-11 h-11 flex items-center justify-center"
                aria-label="Remove GIF"
              >
                <span className="w-5 h-5 rounded-full bg-night-900 text-cream-50 text-[10px] flex items-center justify-center shadow">×</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <CommentComposer
        ref={inputRef}
        className="flex-shrink-0"
        value={text}
        onChange={setText}
        onSubmit={handlePost}
        posting={posting}
        hasAttachment={!!selectedGif}
        placeholder={replyingTo ? replyPlaceholder(replyingTo.name) : 'Add a comment…'}
        gifOpen={showGifPicker}
        onToggleGif={() => { if (gate()) setShowGifPicker(prev => !prev) }}
        onFocusGate={gate}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Comment Thread — top-level comment + collapsible replies
// ═══════════════════════════════════════════════════════════════════════════════

interface CommentThreadProps {
  comment: Comment
  currentUserId: string
  isAdmin: boolean
  requireAuth: () => boolean
  onDelete: (id: string) => Promise<void>
  onToggleLike: (id: string) => Promise<void>
  onToggleReaction: (id: string, type: string) => Promise<void>
  onReply: (comment: Comment) => void
  showReplies: boolean
  loadingReplies: boolean
  onToggleReplies: () => void
  highlightId: string | null
  getLikers: UserFetcher
  getReactors: UserFetcher
}

function CommentThread({
  comment,
  currentUserId,
  isAdmin,
  requireAuth,
  onDelete,
  onToggleLike,
  onToggleReaction,
  onReply,
  showReplies,
  loadingReplies,
  onToggleReplies,
  highlightId,
  getLikers,
  getReactors,
}: CommentThreadProps) {
  return (
    <div>
      <CommentItem
        comment={comment}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        requireAuth={requireAuth}
        onDelete={onDelete}
        onToggleLike={onToggleLike}
        onToggleReaction={onToggleReaction}
        onReply={() => onReply(comment)}
        highlighted={highlightId === comment.id}
        getLikers={getLikers}
        getReactors={getReactors}
      />

      {/* Reply count toggle */}
      {comment.reply_count > 0 && (
        <button
          onClick={onToggleReplies}
          disabled={loadingReplies}
          aria-expanded={showReplies}
          className="ml-9 min-h-[44px] text-xs font-bold text-charcoal-500 hover:text-night-800 transition-colors inline-flex items-center gap-1.5"
        >
          {loadingReplies ? (
            <span className="w-3 h-3 rounded-full border border-cream-200 border-t-sauce-400 animate-spin inline-block" />
          ) : (
            <span className="w-4 border-t border-charcoal-300 inline-block" />
          )}
          {showReplies
            ? 'Hide replies'
            : `View ${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}`}
        </button>
      )}

      {/* Replies — Instagram-style slight indent, no deep nesting */}
      {showReplies && comment.replies && (
        <div className="ml-9 mt-1 space-y-3 border-l-2 border-night-900/15 pl-3">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              requireAuth={requireAuth}
              onDelete={onDelete}
              onToggleLike={onToggleLike}
              onToggleReaction={onToggleReaction}
              onReply={() => onReply(reply)}
              isReply
              highlighted={highlightId === reply.id}
              getLikers={getLikers}
              getReactors={getReactors}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single Comment Item — handles text, GIF, and mixed content
// ═══════════════════════════════════════════════════════════════════════════════

interface CommentItemProps {
  comment: Comment
  currentUserId: string
  isAdmin: boolean
  requireAuth: () => boolean
  onDelete: (id: string) => Promise<void>
  onToggleLike: (id: string) => Promise<void>
  onToggleReaction: (id: string, type: string) => Promise<void>
  onReply: () => void
  isReply?: boolean
  highlighted?: boolean
  getLikers: UserFetcher
  getReactors: UserFetcher
}

function CommentItem({ comment, currentUserId, isAdmin, requireAuth, onDelete, onToggleLike, onToggleReaction, onReply, isReply, highlighted, getLikers, getReactors }: CommentItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const canDelete = comment.user_id === currentUserId || isAdmin
  const isTemp = comment.id.startsWith('temp-')

  useEffect(() => {
    if (!menuOpen) return
    const handleClickAway = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', handleClickAway)
    document.addEventListener('touchstart', handleClickAway)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
      document.removeEventListener('touchstart', handleClickAway)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await onDelete(comment.id)
    } finally {
      setMenuOpen(false)
      setDeleting(false)
    }
  }

  const fetchLikers = useCallback(() => getLikers(comment.id), [comment.id, getLikers])
  const fetchReactors = useCallback(() => getReactors(comment.id), [comment.id, getReactors])
  const totalReactionCount = comment.reactions.reduce((sum, r) => sum + r.count, 0)

  const name = cleanUserText(comment.commenter_name ?? comment.commenter_email?.split('@')[0] ?? 'Unknown') || 'Unknown'
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }) }
    catch { return '' }
  })()

  return (
    <div
      // Notification deep links target this id (/reviews/<id>#comment-<id>)
      id={isTemp ? undefined : `comment-${comment.id}`}
      className={`flex gap-2.5 animate-fade-in scroll-mt-28 rounded-lg transition-colors duration-700 ${isTemp ? 'opacity-60' : ''} ${
        highlighted ? 'bg-gold-100 ring-[6px] ring-gold-100' : ''
      }`}
    >
      {/* Avatar */}
      <div className={`flex-shrink-0 rounded-full overflow-hidden bg-night-700 border border-night-900/20 flex items-center justify-center ${isReply ? 'w-6 h-6' : 'w-8 h-8'}`}>
        <AvatarImage
          src={comment.commenter_avatar}
          alt={name}
          className="w-full h-full object-cover"
          fallback={<span className={`font-extrabold text-cream-50 uppercase ${isReply ? 'text-[10px]' : 'text-xs'}`}>{name.charAt(0).toUpperCase()}</span>}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* On a narrow reply column the time gives way before the name */}
          <span className="flex-shrink-0 max-w-[60%] truncate text-xs font-bold text-night-800 user-text">{name}</span>
          <span className="min-w-0 truncate text-xs text-charcoal-400">{timeAgo}</span>
          {canDelete && !isTemp && (
            <div ref={menuRef} className="relative inline-flex flex-shrink-0 ml-auto">
              {/* 44px hit area; the negative margin keeps the row compact */}
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Comment options"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`w-11 h-11 -my-3 -mr-2 flex items-center justify-center rounded-md transition-colors leading-none ${
                  menuOpen
                    ? 'text-night-700 bg-cream-100'
                    : 'text-charcoal-400 hover:text-night-700 hover:bg-cream-100'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
              {menuOpen && (
                // Anchor right so the popover never overflows past the viewport edge.
                <div role="menu" className="absolute right-0 top-full mt-1 z-30 animate-fade-in">
                  <button
                    role="menuitem"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 pl-2.5 pr-3 min-h-[44px] bg-cream-50 rounded-full shadow-lg border-2 border-night-900 text-xs font-extrabold uppercase tracking-crowd text-sauce-600 hover:bg-sauce-50 transition-all whitespace-nowrap active:scale-95 disabled:opacity-60"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Text content */}
        {comment.text && (
          <p className="text-sm text-night-800 leading-snug mt-0.5 whitespace-pre-line user-text">{cleanUserText(comment.text)}</p>
        )}

        {/* GIF content */}
        {comment.media_url && (
          <div className="mt-1.5 rounded-xl overflow-hidden bg-cream-100 inline-block max-w-[min(240px,100%)]">
            <img
              src={comment.media_url}
              alt="GIF"
              className="w-full h-auto max-h-[180px] object-contain"
              loading="lazy"
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
        )}

        {/* Action strip: reply + like + reactions. Each control has a 44px
            hit area; negative margins keep the strip visually compact. */}
        <div className="flex items-center gap-x-1 -mb-2 flex-wrap">
          {/* Reply */}
          {!isTemp && (
            <button
              onClick={() => { if (requireAuth()) onReply() }}
              className="min-h-[44px] px-2 -ml-2 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:text-sauce-500 transition-colors"
            >
              Reply
            </button>
          )}

          {/* Like */}
          <LikedByOverlay fetchUsers={fetchLikers} count={comment.like_count} label="Likes">
            <button
              onClick={() => { if (!isTemp && requireAuth()) onToggleLike(comment.id) }}
              disabled={isTemp}
              aria-pressed={comment.is_liked_by_me}
              aria-label={`Like comment${comment.like_count > 0 ? ` (${comment.like_count})` : ''}`}
              className="flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] px-2 text-xs transition-colors group"
            >
              <HeartIcon
                filled={comment.is_liked_by_me}
                className={`w-3.5 h-3.5 transition-all group-active:scale-125 ${
                  comment.is_liked_by_me ? 'text-sauce-500' : 'text-charcoal-400 group-hover:text-sauce-400'
                }`}
              />
              {comment.like_count > 0 && (
                <span className={`font-bold ${comment.is_liked_by_me ? 'text-sauce-500' : 'text-charcoal-500'}`}>
                  {comment.like_count}
                </span>
              )}
            </button>
          </LikedByOverlay>

          {/* Reactions */}
          <LikedByOverlay fetchUsers={fetchReactors} count={totalReactionCount} label="Reactions">
            <ReactionPicker
              reactions={comment.reactions}
              onToggle={type => { if (!isTemp && requireAuth()) onToggleReaction(comment.id, type) }}
              disabled={isTemp}
            />
          </LikedByOverlay>
        </div>
      </div>
    </div>
  )
}
