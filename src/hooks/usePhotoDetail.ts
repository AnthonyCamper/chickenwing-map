import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { GalleryPhoto } from '../lib/types'

/**
 * Hook for opening a single photo in PhotoModal from list/map views.
 * Fetches GalleryPhoto data on demand and manages like + comment state.
 * Likes operate at the review level for consistency with gallery view.
 */
export function usePhotoDetail(currentUserId: string) {
  const [photo, setPhoto] = useState<GalleryPhoto | null>(null)
  const [loading, setLoading] = useState(false)

  const open = useCallback(async (photoId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('gallery_feed')
      .select('*')
      .eq('photo_id', photoId)
      .single()
    if (error) {
      toast.error('Could not load photo')
      setPhoto(null)
    } else {
      setPhoto(data as GalleryPhoto | null)
    }
    setLoading(false)
  }, [])

  const close = useCallback(() => setPhoto(null), [])

  const toggleLike = useCallback(async () => {
    if (!photo) return
    const wasLiked = photo.is_liked_by_me
    setPhoto(p =>
      p ? { ...p, is_liked_by_me: !wasLiked, like_count: wasLiked ? p.like_count - 1 : p.like_count + 1 } : p
    )
    const { error } = wasLiked
      ? await supabase.from('review_likes').delete().match({ review_id: photo.review_id, user_id: currentUserId })
      : await supabase.from('review_likes').insert({ review_id: photo.review_id, user_id: currentUserId })

    if (error) {
      setPhoto(p => p ? { ...p, is_liked_by_me: wasLiked, like_count: photo.like_count } : p)
      toast.error('Could not update like')
    } else if (!wasLiked) {
      triggerPushDelivery()
    }
  }, [photo, currentUserId])

  const onCommentAdded = useCallback(() => {
    setPhoto(p => p ? { ...p, comment_count: p.comment_count + 1 } : p)
  }, [])

  return { photo, loading, open, close, toggleLike, onCommentAdded }
}
