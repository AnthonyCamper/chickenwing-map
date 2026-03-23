import { useCallback, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import type { PhotoComment } from '../../lib/types'
import type { AddCommentOptions } from '../../hooks/usePhotoInteractions'
import HeartIcon from './HeartIcon'
import ReactionPicker from './ReactionPicker'
import GifPicker from './GifPicker'
import LikedByOverlay from './LikedByOverlay'
import { fetchCommentLikers, fetchCommentReactors } from '../../lib/reactionDetails'

interface Props {
  comments: PhotoComment[]
  loading: boolean
  currentUserId: string
  isAdmin: boolean
  onAdd: (opts: string | AddCommentOptions) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  onToggleLike: (commentId: string) => Promise<void>
  onToggleReaction: (commentId: string, reactionType: string) => Promise<void>
  onFetchReplies: (parentId: string) => Promise<PhotoComment[]>
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
  onAdd,
  onDelete,
  onToggleLike,
  onToggleReaction,
  onFetchReplies,
  embedded = false,
  replyingTo: externalReplyingTo,
  onSetReplyingTo,
}: Props) {
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

  const handleReply = (comment: PhotoComment) => {
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
          onDelete={onDelete}
          onToggleLike={onToggleLike}
          onToggleReaction={onToggleReaction}
          onReply={handleReply}
          onFetchReplies={onFetchReplies}
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
          onClick={() => setShowGifPicker(prev => !prev)}
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
  comment: PhotoComment
  currentUserId: string
  isAdmin: boolean
  onDelete: (id: string) => Promise<void>
  onToggleLike: (id: string) => Promise<void>
  onToggleReaction: (id: string, type: string) => Promise<void>
  onReply: (comment: PhotoComment) => void
  onFetchReplies: (parentId: string) => Promise<PhotoComment[]>
}

function CommentThread({
  comment,
  currentUserId,
  isAdmin,
  onDelete,
  onToggleLike,
  onToggleReaction,
  onReply,
  onFetchReplies,
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
        onDelete={onDelete}
        onToggleLike={onToggleLike}
        onToggleReaction={onToggleReaction}
        onReply={() => onReply(comment)}
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
              onDelete={onDelete}
              onToggleLike={onToggleLike}
              onToggleReaction={onToggleReaction}
              onReply={() => onReply(reply)}
              isReply
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
  comment: PhotoComment
  currentUserId: string
  isAdmin: boolean
  onDelete: (id: string) => Promise<void>
  onToggleLike: (id: string) => Promise<void>
  onToggleReaction: (id: string, type: string) => Promise<void>
  onReply: () => void
  isReply?: boolean
}

function CommentItem({ comment, currentUserId, isAdmin, onDelete, onToggleLike, onToggleReaction, onReply, isReply }: CommentItemProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canDelete = comment.user_id === currentUserId || isAdmin
  const isTemp = comment.id.startsWith('temp-')

  const fetchLikers = useCallback(() => fetchCommentLikers(comment.id), [comment.id])
  const fetchReactors = useCallback(() => fetchCommentReactors(comment.id), [comment.id])
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
            confirmDelete ? (
              <span className="flex items-center gap-1">
                <button onClick={() => onDelete(comment.id)} className="text-xs text-red-500 font-medium">Delete</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-charcoal-300">Cancel</button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-charcoal-200 hover:text-red-400 transition-colors"
              >
                ×
              </button>
            )
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
              onClick={onReply}
              className="text-xs text-charcoal-400 hover:text-charcoal-600 font-medium transition-colors"
            >
              Reply
            </button>
          )}

          {/* Like */}
          <LikedByOverlay fetchUsers={fetchLikers} count={comment.like_count} label="Likes">
            <button
              onClick={() => !isTemp && onToggleLike(comment.id)}
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
              onToggle={type => !isTemp && onToggleReaction(comment.id, type)}
              disabled={isTemp}
            />
          </LikedByOverlay>
        </div>
      </div>
    </div>
  )
}
