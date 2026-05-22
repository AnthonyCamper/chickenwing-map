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
          <div className="w-5 h-5 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
        </div>
      )}
      {!loading && comments.length === 0 && (
        <p className="text-center text-xs text-charcoal-300 py-6">
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
        <div className="flex-shrink-0 border-t border-warmgray-100 px-3 py-2">
          <GifPicker
            onSelect={handleGifSelect}
            onClose={() => setShowGifPicker(false)}
          />
        </div>
      )}

      {/* Reply context + GIF preview */}
      {(replyingTo || selectedGif) && (
        <div className="flex-shrink-0 border-t border-warmgray-100 px-4 py-2 bg-warmgray-50 flex items-center gap-2 flex-wrap">
          {replyingTo && (
            <span className="text-xs text-charcoal-500">
              Replying to <span className="font-semibold">{replyingTo.name}</span>
              <button onClick={cancelReply} className="ml-1.5 text-charcoal-300 hover:text-charcoal-500">×</button>
            </span>
          )}
          {selectedGif && (
            <div className="relative">
              <img src={selectedGif} alt="GIF" className="h-12 rounded-md" />
              <button
                onClick={() => setSelectedGif(null)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-charcoal-700 text-white text-[10px] flex items-center justify-center"
              >×</button>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-warmgray-100 px-4 py-3 flex items-end gap-2 bg-white">
        <button
          type="button"
          onClick={() => { if (gate()) setShowGifPicker(prev => !prev) }}
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-colors ${
            showGifPicker ? 'bg-amber-100 text-amber-600' : 'bg-warmgray-100 text-charcoal-500 hover:bg-warmgray-200'
          }`}
          title="GIF"
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
          className="flex-1 resize-none rounded-xl border border-warmgray-300 bg-warmgray-50 px-3 py-2 text-base text-charcoal-700 placeholder:text-charcoal-300 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition-colors"
          style={{ maxHeight: '80px', overflowY: 'auto' }}
        />
        <button
          onClick={handlePost}
          disabled={(!text.trim() && !selectedGif) || posting}
          className="btn-primary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-40"
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
          className="ml-9 mt-1.5 text-xs text-charcoal-400 hover:text-charcoal-600 transition-colors flex items-center gap-1"
        >
          {loadingReplies ? (
            <span className="w-3 h-3 rounded-full border border-amber-300 border-t-amber-400 animate-spin inline-block" />
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
        <div className="ml-9 mt-2 space-y-3 border-l-2 border-warmgray-200 pl-3">
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
      <div className={`flex-shrink-0 rounded-full overflow-hidden bg-warmgray-200 flex items-center justify-center ${isReply ? 'w-6 h-6' : 'w-7 h-7'}`}>
        {comment.commenter_avatar ? (
          <img src={comment.commenter_avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className={`font-semibold text-charcoal-500 ${isReply ? 'text-[10px]' : 'text-xs'}`}>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-charcoal-700">{name}</span>
          <span className="text-xs text-charcoal-300">{timeAgo}</span>
          {canDelete && !isTemp && (
            <div ref={menuRef} className="relative inline-flex">
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Comment options"
                className={`w-5 h-5 flex items-center justify-center rounded-md transition-colors leading-none text-base ${
                  menuOpen
                    ? 'text-charcoal-600 bg-warmgray-100'
                    : 'text-charcoal-200 hover:text-charcoal-500 hover:bg-warmgray-100'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-30 animate-fade-in">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-white rounded-full shadow-lg border border-warmgray-200 text-xs font-semibold text-red-500 hover:bg-red-50 hover:border-red-200 transition-all whitespace-nowrap active:scale-95 disabled:opacity-60"
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
          <p className="text-sm text-charcoal-700 leading-snug mt-0.5 break-words">{comment.text}</p>
        )}

        {/* GIF content */}
        {comment.media_url && (
          <div className="mt-1.5 rounded-xl overflow-hidden bg-warmgray-100 inline-block max-w-[240px]">
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
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {/* Reply */}
          {!isTemp && (
            <button
              onClick={() => { if (requireAuth()) onReply() }}
              className="text-xs text-charcoal-400 hover:text-charcoal-600 font-medium transition-colors"
            >
              Reply
            </button>
          )}

          {/* Like */}
          <LikedByOverlay fetchUsers={fetchLikers} count={comment.like_count} label="Likes">
            <button
              onClick={() => { if (!isTemp && requireAuth()) onToggleLike(comment.id) }}
              disabled={isTemp}
              className="flex items-center gap-1 text-xs transition-colors group"
            >
              <HeartIcon
                filled={comment.is_liked_by_me}
                className={`w-3.5 h-3.5 transition-all group-active:scale-125 ${
                  comment.is_liked_by_me ? 'text-amber-400' : 'text-charcoal-300 group-hover:text-amber-300'
                }`}
              />
              {comment.like_count > 0 && (
                <span className={`${comment.is_liked_by_me ? 'text-amber-400' : 'text-charcoal-300'}`}>
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
