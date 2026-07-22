import { useCallback, useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { Comment, AddCommentOptions } from '../../lib/types'
import type { ReactionUser } from '../../lib/reactionDetails'
import HeartIcon from './HeartIcon'
import ReactionPicker from './ReactionPicker'
import GifPicker from './GifPicker'
import LikedByOverlay from './LikedByOverlay'
import { fetchReviewCommentLikers, fetchReviewCommentReactors } from '../../lib/reactionDetails'

type UserFetcher = (id: string) => Promise<ReactionUser[]>

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
}: Props) {
  const getLikers = likersFetcher ?? fetchReviewCommentLikers
  const getReactors = reactorsFetcher ?? fetchReviewCommentReactors
  const gate = requireAuth ?? (() => true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [selectedGif, setSelectedGif] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  const handlePost = async () => {
    if ((!text.trim() && !selectedGif) || posting) return
    if (!gate()) return
    setPosting(true)
    await onAdd({
      text: text.trim() || undefined,
      parentCommentId: replyingTo?.id ?? null,
      mediaUrl: selectedGif ?? undefined,
      contentType: selectedGif && text.trim() ? 'mixed' : selectedGif ? 'gif' : 'text',
    })
    setText('')
    setSelectedGif(null)
    setReplyingTo(null)
    setShowGifPicker(false)
    setPosting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePost()
    }
  }

  const handleReply = (comment: Comment) => {
    if (!gate()) return
    const name = comment.commenter_name ?? comment.commenter_email?.split('@')[0] ?? 'Unknown'
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
          No comments yet — be the first!
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
          onFetchReplies={onFetchReplies}
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
            <span className="text-xs text-charcoal-600">
              Replying to <span className="font-bold text-night-800">{replyingTo.name}</span>
              <button
                onClick={cancelReply}
                className="ml-1.5 inline-flex items-center justify-center w-7 h-7 -my-2 align-middle rounded-full text-charcoal-400 hover:bg-cream-200 hover:text-night-800"
                aria-label="Cancel reply"
              >×</button>
            </span>
          )}
          {selectedGif && (
            <div className="relative">
              <img src={selectedGif} alt="GIF" className="h-12 rounded-md" />
              <button
                onClick={() => setSelectedGif(null)}
                className="absolute -top-2.5 -right-2.5 w-7 h-7 flex items-center justify-center"
                aria-label="Remove GIF"
              >
                <span className="w-5 h-5 rounded-full bg-night-900 text-cream-50 text-[10px] flex items-center justify-center shadow">×</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-night-900/10 px-3 py-2.5 flex items-end gap-2 bg-cream-50">
        <button
          type="button"
          onClick={() => { if (gate()) setShowGifPicker(prev => !prev) }}
          className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-xs font-extrabold uppercase tracking-crowd transition-colors ${
            showGifPicker ? 'bg-sauce-100 text-sauce-600' : 'bg-cream-100 text-charcoal-500 hover:bg-cream-200'
          }`}
          title="GIF"
          aria-label="Add a GIF"
        >
          GIF
        </button>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={e => { if (!gate()) e.target.blur() }}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? `Reply to ${replyingTo.name}…` : 'Add a comment…'}
          maxLength={500}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-night-900/15 bg-cream-100 px-3 py-2.5 text-base text-night-800 placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-sauce-300 focus:border-night-900/30 transition-colors"
          style={{ maxHeight: '96px', minHeight: '44px', overflowY: 'auto' }}
        />
        <button
          onClick={handlePost}
          disabled={(!text.trim() && !selectedGif) || posting}
          className="btn-primary px-4 min-h-[44px] text-sm flex-shrink-0 disabled:opacity-40"
        >
          {posting ? '…' : 'Post'}
        </button>
      </div>
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
  onFetchReplies: (parentId: string) => Promise<Comment[]>
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
  onFetchReplies,
  getLikers,
  getReactors,
}: CommentThreadProps) {
  const [showReplies, setShowReplies] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)

  const handleToggleReplies = async () => {
    if (showReplies) {
      setShowReplies(false)
      return
    }
    setLoadingReplies(true)
    await onFetchReplies(comment.id)
    setShowReplies(true)
    setLoadingReplies(false)
  }

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
        getLikers={getLikers}
        getReactors={getReactors}
      />

      {/* Reply count toggle */}
      {comment.reply_count > 0 && (
        <button
          onClick={handleToggleReplies}
          disabled={loadingReplies}
          className="ml-9 mt-1.5 min-h-[32px] text-xs font-bold text-charcoal-500 hover:text-night-800 transition-colors inline-flex items-center gap-1.5"
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
        <div className="ml-9 mt-2 space-y-3 border-l-2 border-night-900/15 pl-3">
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
  getLikers: UserFetcher
  getReactors: UserFetcher
}

function CommentItem({ comment, currentUserId, isAdmin, requireAuth, onDelete, onToggleLike, onToggleReaction, onReply, isReply, getLikers, getReactors }: CommentItemProps) {
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
    document.addEventListener('mousedown', handleClickAway)
    document.addEventListener('touchstart', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
      document.removeEventListener('touchstart', handleClickAway)
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

  const name = comment.commenter_name ?? comment.commenter_email?.split('@')[0] ?? 'Unknown'
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(comment.created_at), { addSuffix: true }) }
    catch { return '' }
  })()

  return (
    <div className={`flex gap-2.5 animate-fade-in ${isTemp ? 'opacity-60' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 rounded-full overflow-hidden bg-night-700 border border-night-900/20 flex items-center justify-center ${isReply ? 'w-6 h-6' : 'w-8 h-8'}`}>
        {comment.commenter_avatar ? (
          <img src={comment.commenter_avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className={`font-extrabold text-cream-50 uppercase ${isReply ? 'text-[10px]' : 'text-xs'}`}>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-night-800">{name}</span>
          <span className="text-xs text-charcoal-400">{timeAgo}</span>
          {canDelete && !isTemp && (
            <div ref={menuRef} className="relative inline-flex">
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Comment options"
                aria-expanded={menuOpen}
                className={`w-8 h-8 -my-1 flex items-center justify-center rounded-md transition-colors leading-none ${
                  menuOpen
                    ? 'text-night-700 bg-cream-100'
                    : 'text-charcoal-400 hover:text-night-700 hover:bg-cream-100'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
              {menuOpen && (
                // Anchor right so the popover never overflows past the viewport edge.
                <div className="absolute right-0 top-full mt-1 z-30 animate-fade-in">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 pl-2.5 pr-3 py-2 bg-cream-50 rounded-full shadow-lg border-2 border-night-900 text-xs font-extrabold uppercase tracking-crowd text-sauce-600 hover:bg-sauce-50 transition-all whitespace-nowrap active:scale-95 disabled:opacity-60"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <p className="text-sm text-night-800 leading-snug mt-0.5 break-words">{comment.text}</p>
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

        {/* Action strip: reply + like + reactions */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Reply */}
          {!isTemp && (
            <button
              onClick={() => { if (requireAuth()) onReply() }}
              className="min-h-[28px] px-1 -mx-1 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:text-sauce-500 transition-colors"
            >
              Reply
            </button>
          )}

          {/* Like */}
          <LikedByOverlay fetchUsers={fetchLikers} count={comment.like_count} label="Likes">
            <button
              onClick={() => { if (!isTemp && requireAuth()) onToggleLike(comment.id) }}
              disabled={isTemp}
              aria-label={comment.is_liked_by_me ? 'Unlike comment' : 'Like comment'}
              className="flex items-center gap-1 min-h-[28px] px-1 -mx-1 text-xs transition-colors group"
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
