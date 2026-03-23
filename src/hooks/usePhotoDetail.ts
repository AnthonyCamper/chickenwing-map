import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { GalleryPhoto } from '../lib/types'

/**
 * Batch-fetch comment counts for a set of photo IDs.
 * Returns a map of photoId → count (only entries with count > 0).
 */
export async function fetchCommentCounts(photoIds: string[]): Promise<Record<string, number>> {
  if (photoIds.length === 0) return {}
  const { data } = await supabase
    .from('photo_comments')
    .select('photo_id')
    .in('photo_id', photoIds)
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { photo_id: string }[]) {
    counts[row.photo_id] = (counts[row.photo_id] ?? 0) + 1
  }
  return counts
}

/**
 * Hook for opening a single photo in PhotoModal from list/map views.
 * Fetches GalleryPhoto data on demand and manages like + comment state.
 */
export function usePhotoDetail(currentUserId: string) {
  const [photo, setPhoto] = useState<GalleryPhoto | null>(null)
  const [loading, setLoading] = useState(false)

  const open = useCallback(async (photoId: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('gallery_feed')
      .select('*')
      .eq('photo_id', photoId)
      .single()
    setPhoto(data as GalleryPhoto | null)
    setLoading(false)
  }, [])

  const close = useCallback(() => setPhoto(null), [])

  const toggleLike = useCallback(async () => {
    if (!photo) return
    const wasLiked = photo.is_liked_by_me
    setPhoto(p =>
      p ? { ...p, is_liked_by_me: !wasLiked, like_count: wasLiked ? p.like_count - 1 : p.like_count + 1 } : p
    )
    try {
      if (wasLiked) {
        await supabase.from('photo_likes').delete().match({ photo_id: photo.photo_id, user_id: currentUserId })
      } else {
        await supabase.from('photo_likes').insert({ photo_id: photo.photo_id, user_id: currentUserId })
        triggerPushDelivery()
      }
    } catch {
      setPhoto(p => p ? { ...p, is_liked_by_me: wasLiked, like_count: photo.like_count } : p)
    }
  }, [photo, currentUserId])

  const onCommentAdded = useCallback(() => {
    setPhoto(p => p ? { ...p, comment_count: p.comment_count + 1 } : p)
  }, [])

  return { photo, loading, open, close, toggleLike, onCommentAdded }
}
