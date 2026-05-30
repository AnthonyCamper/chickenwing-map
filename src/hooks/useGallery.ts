import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { GalleryPhoto, GalleryReviewItem } from '../lib/types'

const PAGE_SIZE = 21 // 3-column multiples look clean

/**
 * Group flat gallery_feed rows (one per photo) into review-level items.
 * Photos within each review are sorted by display_order.
 */
export function groupByReview(photos: GalleryPhoto[]): GalleryReviewItem[] {
  const map = new Map<string, GalleryReviewItem>()

  for (const p of photos) {
    let item = map.get(p.review_id)
    if (!item) {
      item = {
        review_id: p.review_id,
        overall_rating: p.overall_rating,
        wing_flavor: p.wing_flavor,
        wing_flavors: p.wing_flavors,
        review_text: p.review_text,
        visited_at: p.visited_at,
        wing_spot_id: p.wing_spot_id,
        spot_name: p.spot_name,
        spot_slug: p.spot_slug,
        spot_address: p.spot_address,
        reviewer_id: p.reviewer_id,
        reviewer_name: p.reviewer_name,
        reviewer_username: p.reviewer_username,
        reviewer_avatar: p.reviewer_avatar,
        reviewer_email: p.reviewer_email,
        reviewer_is_private: p.reviewer_is_private,
        like_count: p.like_count,
        comment_count: p.comment_count,
        is_liked_by_me: p.is_liked_by_me,
        event_id: p.event_id,
        event_slug: p.event_slug,
        event_name: p.event_name,
        photos: [],
      }
      map.set(p.review_id, item)
    }
    // Keep like/comment counts in sync (all rows for a review share the same values)
    item.like_count = p.like_count
    item.is_liked_by_me = p.is_liked_by_me
    item.comment_count = p.comment_count

    item.photos.push({
      photo_id: p.photo_id,
      photo_url: p.photo_url,
      display_order: p.display_order,
      photo_created_at: p.photo_created_at,
    })
  }

  for (const item of map.values()) {
    item.photos.sort((a, b) => a.display_order - b.display_order)
  }

  return Array.from(map.values())
}

interface UseGalleryReturn {
  reviews: GalleryReviewItem[]
  /** @deprecated Use reviews instead */
  photos: GalleryPhoto[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => void
  toggleLike: (reviewId: string) => Promise<void>
  refreshReview: (reviewId: string) => void
  /** @deprecated Use refreshReview instead */
  refreshPhoto: (photoId: string) => void
}

export function useGallery(currentUserId: string, followingOnly = false): UseGalleryReturn {
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
      let followingIds: string[] | null = null
      if (followingOnly && currentUserId) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId)
        followingIds = (follows ?? []).map((f: any) => f.following_id)
        if (followingIds.length === 0) {
          setPhotos(append ? prev => prev : [])
          setHasMore(false)
          setLoading(false)
          setLoadingMore(false)
          return
        }
      }

      let query = supabase
        .from('gallery_feed')
        .select('*')
        .order('photo_created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (followingIds) {
        query = query.in('reviewer_id', followingIds)
      }

      const { data, error: err } = await query
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
  }, [currentUserId, followingOnly])

  useEffect(() => {
    offsetRef.current = 0
    fetchPage(0, false)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    fetchPage(offsetRef.current, true)
  }, [loadingMore, hasMore, fetchPage])

  // Toggle like at the review level
  const toggleLike = useCallback(async (reviewId: string) => {
    const reviewPhoto = photos.find(p => p.review_id === reviewId)
    if (!reviewPhoto) return

    const wasLiked = reviewPhoto.is_liked_by_me
    const prevLikeCount = reviewPhoto.like_count

    // Optimistic update — update ALL photos belonging to this review
    setPhotos(prev =>
      prev.map(p =>
        p.review_id === reviewId
          ? { ...p, is_liked_by_me: !wasLiked, like_count: wasLiked ? p.like_count - 1 : p.like_count + 1 }
          : p
      )
    )

    try {
      if (wasLiked) {
        await supabase
          .from('review_likes')
          .delete()
          .match({ review_id: reviewId, user_id: currentUserId })
      } else {
        await supabase
          .from('review_likes')
          .insert({ review_id: reviewId, user_id: currentUserId })
        triggerPushDelivery()
      }
    } catch {
      setPhotos(prev =>
        prev.map(p =>
          p.review_id === reviewId
            ? { ...p, is_liked_by_me: wasLiked, like_count: prevLikeCount }
            : p
        )
      )
    }
  }, [photos, currentUserId])

  // After adding a comment, bump the comment count for the review
  const refreshReview = useCallback((reviewId: string) => {
    setPhotos(prev =>
      prev.map(p =>
        p.review_id === reviewId ? { ...p, comment_count: p.comment_count + 1 } : p
      )
    )
  }, [])

  // Deprecated: kept for backward compat with legacy call sites
  const refreshPhoto = useCallback((photoId: string) => {
    const photo = photos.find(p => p.photo_id === photoId)
    if (photo) {
      refreshReview(photo.review_id)
    }
  }, [photos, refreshReview])

  const reviews = groupByReview(photos)

  return {
    reviews,
    photos,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    toggleLike,
    refreshReview,
    refreshPhoto,
  }
}
