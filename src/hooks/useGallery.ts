import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { GalleryPhoto } from '../lib/types'

const PAGE_SIZE = 21 // 3-column multiples look clean

interface UseGalleryReturn {
  photos: GalleryPhoto[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => void
  toggleLike: (photoId: string) => Promise<void>
  refreshPhoto: (photoId: string) => void
}

export function useGallery(currentUserId: string): UseGalleryReturn {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(0)

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      const { data, error: err } = await supabase
        .from('gallery_feed')
        .select('*')
        .order('photo_created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (err) throw new Error(err.message)

      const rows = (data ?? []) as GalleryPhoto[]
      setHasMore(rows.length === PAGE_SIZE)
      setPhotos(prev => append ? [...prev, ...rows] : rows)
      offsetRef.current = offset + rows.length
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    offsetRef.current = 0
    fetchPage(0, false)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    fetchPage(offsetRef.current, true)
  }, [loadingMore, hasMore, fetchPage])

  const toggleLike = useCallback(async (photoId: string) => {
    const photo = photos.find(p => p.photo_id === photoId)
    if (!photo) return

    const wasLiked = photo.is_liked_by_me
    // Optimistic update
    setPhotos(prev =>
      prev.map(p =>
        p.photo_id === photoId
          ? { ...p, is_liked_by_me: !wasLiked, like_count: wasLiked ? p.like_count - 1 : p.like_count + 1 }
          : p
      )
    )

    try {
      if (wasLiked) {
        await supabase
          .from('photo_likes')
          .delete()
          .match({ photo_id: photoId, user_id: currentUserId })
      } else {
        await supabase
          .from('photo_likes')
          .insert({ photo_id: photoId, user_id: currentUserId })
        triggerPushDelivery()
      }
    } catch {
      // Revert on failure
      setPhotos(prev =>
        prev.map(p =>
          p.photo_id === photoId
            ? { ...p, is_liked_by_me: wasLiked, like_count: photo.like_count }
            : p
        )
      )
    }
  }, [photos, currentUserId])

  // After adding a comment, bump the comment count locally
  const refreshPhoto = useCallback((photoId: string) => {
    setPhotos(prev =>
      prev.map(p =>
        p.photo_id === photoId ? { ...p, comment_count: p.comment_count + 1 } : p
      )
    )
  }, [])

  return { photos, loading, loadingMore, hasMore, error, loadMore, toggleLike, refreshPhoto }
}
