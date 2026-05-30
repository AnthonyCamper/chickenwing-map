import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { CrawlComment, CommentReaction, CommentContentType, AddCommentOptions } from '../lib/types'

interface RawComment {
  id: string
  crawl_id: string
  user_id: string
  text: string | null
  created_at: string
  parent_comment_id: string | null
  content_type: CommentContentType
  media_url: string | null
  commenter_name: string | null
  commenter_avatar: string | null
  commenter_email: string | null
  like_count: number
  is_liked_by_me: boolean
  reply_count: number
}

interface RawReaction {
  comment_id: string
  reaction_type: string
  user_id: string
}

interface UseCrawlCommentsReturn {
  comments: CrawlComment[]
  loading: boolean
  addComment: (opts: string | AddCommentOptions) => Promise<void>
  deleteComment: (commentId: string) => Promise<void>
  toggleCommentLike: (commentId: string) => Promise<void>
  toggleReaction: (commentId: string, reactionType: string) => Promise<void>
  fetchReplies: (parentId: string) => Promise<CrawlComment[]>
}

export function useCrawlComments(
  crawlId: string,
  currentUserId: string
): UseCrawlCommentsReturn {
  const [comments, setComments] = useState<CrawlComment[]>([])
  const [loading, setLoading] = useState(true)

  const attachReactions = useCallback(
    (rawComments: RawComment[], reactions: RawReaction[]): CrawlComment[] => {
      const reactionMap = new Map<string, RawReaction[]>()
      for (const r of reactions) {
        const list = reactionMap.get(r.comment_id) ?? []
        list.push(r)
        reactionMap.set(r.comment_id, list)
      }

      return rawComments.map(c => {
        const raws = reactionMap.get(c.id) ?? []
        const aggregated = new Map<string, { count: number; is_mine: boolean }>()
        for (const r of raws) {
          const entry = aggregated.get(r.reaction_type) ?? { count: 0, is_mine: false }
          entry.count++
          if (r.user_id === currentUserId) entry.is_mine = true
          aggregated.set(r.reaction_type, entry)
        }
        const reactions: CommentReaction[] = Array.from(aggregated.entries()).map(
          ([reaction_type, { count, is_mine }]) => ({ reaction_type, count, is_mine })
        )
        return { ...c, reactions }
      })
    },
    [currentUserId]
  )

  const fetchComments = useCallback(async () => {
    if (!crawlId) return
    setLoading(true)
    try {
      const { data: commentData } = await supabase
        .from('crawl_comments_detailed')
        .select('*')
        .eq('crawl_id', crawlId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: true })

      const rawComments = (commentData ?? []) as RawComment[]

      let reactions: RawReaction[] = []
      if (rawComments.length > 0) {
        const { data: rData } = await supabase
          .from('crawl_comment_reactions')
          .select('comment_id, reaction_type, user_id')
          .in('comment_id', rawComments.map(c => c.id))
        reactions = (rData ?? []) as RawReaction[]
      }

      setComments(attachReactions(rawComments, reactions))
    } finally {
      setLoading(false)
    }
  }, [crawlId, attachReactions])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const fetchReplies = useCallback(
    async (parentId: string): Promise<CrawlComment[]> => {
      const { data: replyData } = await supabase
        .from('crawl_comments_detailed')
        .select('*')
        .eq('parent_comment_id', parentId)
        .order('created_at', { ascending: true })

      const rawReplies = (replyData ?? []) as RawComment[]

      let reactions: RawReaction[] = []
      if (rawReplies.length > 0) {
        const { data: rData } = await supabase
          .from('crawl_comment_reactions')
          .select('comment_id, reaction_type, user_id')
          .in('comment_id', rawReplies.map(c => c.id))
        reactions = (rData ?? []) as RawReaction[]
      }

      const replies = attachReactions(rawReplies, reactions)

      setComments(prev =>
        prev.map(c => (c.id === parentId ? { ...c, replies, reply_count: replies.length } : c))
      )

      return replies
    },
    [attachReactions]
  )

  const addComment = useCallback(
    async (opts: string | AddCommentOptions) => {
      const options: AddCommentOptions =
        typeof opts === 'string' ? { text: opts } : opts

      const trimmedText = options.text?.trim() || null
      const mediaUrl = options.mediaUrl?.trim() || null
      const parentCommentId = options.parentCommentId || null
      const contentType: CommentContentType =
        options.contentType ?? (mediaUrl && trimmedText ? 'mixed' : mediaUrl ? 'gif' : 'text')

      if (!trimmedText && !mediaUrl) return

      const tempId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? `temp-${crypto.randomUUID()}`
          : `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const temp: CrawlComment = {
        id: tempId,
        crawl_id: crawlId,
        user_id: currentUserId,
        text: trimmedText,
        created_at: new Date().toISOString(),
        parent_comment_id: parentCommentId,
        content_type: contentType,
        media_url: mediaUrl,
        commenter_name: null,
        commenter_avatar: null,
        commenter_email: null,
        like_count: 0,
        is_liked_by_me: false,
        reply_count: 0,
        reactions: [],
      }

      if (parentCommentId) {
        setComments(prev =>
          prev.map(c => {
            if (c.id !== parentCommentId) return c
            return {
              ...c,
              reply_count: c.reply_count + 1,
              replies: [...(c.replies ?? []), temp],
            }
          })
        )
      } else {
        setComments(prev => [...prev, temp])
      }

      const insertData: Record<string, unknown> = {
        crawl_id: crawlId,
        user_id: currentUserId,
        content_type: contentType,
      }
      if (trimmedText) insertData.text = trimmedText
      if (mediaUrl) insertData.media_url = mediaUrl
      if (parentCommentId) insertData.parent_comment_id = parentCommentId

      const { data: inserted, error } = await supabase
        .from('crawl_comments')
        .insert(insertData)
        .select('id')
        .single()

      if (error || !inserted) {
        if (parentCommentId) {
          setComments(prev =>
            prev.map(c => {
              if (c.id !== parentCommentId) return c
              return {
                ...c,
                reply_count: Math.max(0, c.reply_count - 1),
                replies: (c.replies ?? []).filter(r => r.id !== tempId),
              }
            })
          )
        } else {
          setComments(prev => prev.filter(c => c.id !== tempId))
        }
        return
      }

      // Swap the temp row's id for the real one in place — no full refetch.
      const realId = (inserted as { id: string }).id
      if (parentCommentId) {
        setComments(prev =>
          prev.map(c => {
            if (c.id !== parentCommentId) return c
            return {
              ...c,
              replies: (c.replies ?? []).map(r => (r.id === tempId ? { ...r, id: realId } : r)),
            }
          })
        )
      } else {
        setComments(prev => prev.map(c => (c.id === tempId ? { ...c, id: realId } : c)))
      }
      triggerPushDelivery()
    },
    [crawlId, currentUserId]
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      // Snapshot for rollback in case the DB rejects (RLS, network).
      let snapshot: CrawlComment[] = []
      setComments(prev => {
        snapshot = prev
        const isTopLevel = prev.some(c => c.id === commentId)
        if (isTopLevel) {
          return prev.filter(c => c.id !== commentId)
        }
        return prev.map(c => {
          if (!c.replies?.some(r => r.id === commentId)) return c
          return {
            ...c,
            reply_count: Math.max(0, c.reply_count - 1),
            replies: c.replies.filter(r => r.id !== commentId),
          }
        })
      })
      const { error } = await supabase.from('crawl_comments').delete().eq('id', commentId)
      if (error) {
        setComments(snapshot)
      }
    },
    []
  )

  const toggleCommentLike = useCallback(
    async (commentId: string) => {
      const findComment = (list: CrawlComment[]): CrawlComment | undefined => {
        for (const c of list) {
          if (c.id === commentId) return c
          const inReplies = c.replies?.find(r => r.id === commentId)
          if (inReplies) return inReplies
        }
        return undefined
      }

      const comment = findComment(comments)
      if (!comment) return
      const wasLiked = comment.is_liked_by_me

      const updateLike = (c: CrawlComment): CrawlComment =>
        c.id === commentId
          ? { ...c, is_liked_by_me: !wasLiked, like_count: wasLiked ? c.like_count - 1 : c.like_count + 1 }
          : c.replies
            ? { ...c, replies: c.replies.map(updateLike) }
            : c

      setComments(prev => prev.map(updateLike))

      const { error } = wasLiked
        ? await supabase
            .from('crawl_comment_likes')
            .delete()
            .match({ comment_id: commentId, user_id: currentUserId })
        : await supabase
            .from('crawl_comment_likes')
            .insert({ comment_id: commentId, user_id: currentUserId })

      if (error) {
        const revertLike = (c: CrawlComment): CrawlComment =>
          c.id === commentId
            ? { ...c, is_liked_by_me: wasLiked, like_count: comment.like_count }
            : c.replies
              ? { ...c, replies: c.replies.map(revertLike) }
              : c
        setComments(prev => prev.map(revertLike))
      } else if (!wasLiked) {
        triggerPushDelivery()
      }
    },
    [comments, currentUserId]
  )

  const toggleReaction = useCallback(
    async (commentId: string, reactionType: string) => {
      const findComment = (list: CrawlComment[]): CrawlComment | undefined => {
        for (const c of list) {
          if (c.id === commentId) return c
          const inReplies = c.replies?.find(r => r.id === commentId)
          if (inReplies) return inReplies
        }
        return undefined
      }

      const comment = findComment(comments)
      if (!comment) return

      const existing = comment.reactions.find(r => r.reaction_type === reactionType)
      const isMine = existing?.is_mine ?? false

      const updateReactions = (c: CrawlComment): CrawlComment => {
        if (c.id === commentId) {
          const updated = c.reactions.filter(r => r.reaction_type !== reactionType)
          if (!isMine) {
            updated.push({ reaction_type: reactionType, count: (existing?.count ?? 0) + 1, is_mine: true })
          } else if (existing && existing.count > 1) {
            updated.push({ reaction_type: reactionType, count: existing.count - 1, is_mine: false })
          }
          return { ...c, reactions: updated }
        }
        return c.replies ? { ...c, replies: c.replies.map(updateReactions) } : c
      }

      setComments(prev => prev.map(updateReactions))

      const { error } = isMine
        ? await supabase
            .from('crawl_comment_reactions')
            .delete()
            .match({ comment_id: commentId, user_id: currentUserId, reaction_type: reactionType })
        : await supabase
            .from('crawl_comment_reactions')
            .insert({ comment_id: commentId, user_id: currentUserId, reaction_type: reactionType })

      if (error) {
        const revertReactions = (c: CrawlComment): CrawlComment =>
          c.id === commentId
            ? { ...c, reactions: comment.reactions }
            : c.replies
              ? { ...c, replies: c.replies.map(revertReactions) }
              : c
        setComments(prev => prev.map(revertReactions))
      } else if (!isMine) {
        triggerPushDelivery()
      }
    },
    [comments, currentUserId]
  )

  return { comments, loading, addComment, deleteComment, toggleCommentLike, toggleReaction, fetchReplies }
}
