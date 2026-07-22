import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { GalleryPhoto, GalleryReviewItem } from '../lib/types'

const PAGE_SIZE = 21 // 3-column multiples look clean

/**
 * Module-level cache of loaded feed pages, keyed by (user, followingOnly).
 * Survives component unmount/remount within an SPA session, so navigating
 * into a detail route and swiping back restores the full list (and therefore
 * the scroll position) instead of refetching from page 0 and snapping to top.
 * Cleared naturally on full page reload.
 */
interface FeedCache {
  photos: GalleryPhoto[]
  offset: number
  hasMore: boolean
}
const feedCache = new Map<string, FeedCache>()
const feedCacheKey = (userId: string, followingOnly: boolean) =>
  `${userId}|${followingOnly ? 'following' : 'all'}`

/**
 * Drop all cached feed pages. Called after a review is created, updated or
 * deleted so the next gallery mount refetches fresh data instead of restoring
 * a stale list.
 */
export function invalidateGalleryFeedCache() {
  feedCache.clear()
}

/**
 * Group flat gallery_feed rows (one per photo) into review-level items.
 * Photos within each review are sorted by display_order.
 */
export function groupByReview(photos: GalleryPhoto[]): GalleryReviewItem[] {
  const map = new Map<string, GalleryReviewItem>()
  const seenPhotoIds = new Set<string>()

  for (const p of photos) {
    // Pages can overlap when rows shift between fetches — never show a photo twice
    if (seenPhotoIds.has(p.photo_id)) continue
    seenPhotoIds.add(p.photo_id)

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
  /** True when this mount seeded its list from the module cache (back-nav
   *  remount) rather than fetching fresh — used to gate scroll restoration. */
  restoredFromCache: boolean
  loadMore: () => void
  toggleLike: (reviewId: string) => Promise<void>
  refreshReview: (reviewId: string) => void
  /** @deprecated Use refreshReview instead */
  refreshPhoto: (photoId: string) => void
}

export function useGallery(currentUserId: string, followingOnly = false): UseGalleryReturn {
  const cacheKey = feedCacheKey(currentUserId, followingOnly)
  const cached = feedCache.get(cacheKey)

  // Seed from cache so a remount paints the full list immediately (no spinner,
  // no top-snap) — this is what makes swipe-back scroll restoration work.
  const [photos, setPhotos] = useState<GalleryPhoto[]>(cached?.photos ?? [])
  const [loading, setLoading] = useState(!cached)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true)
  const [error, setError] = useState<string | null>(null)
  const offsetRef = useRef(cached?.offset ?? 0)
  // Capture "was there a cache at mount" once — distinguishes a back-nav
  // remount (restore scroll) from a cold load (start at top).
  const restoredFromCacheRef = useRef(!!cached)
  // Which feed the current local state belongs to. Guards the cache-sync
  // effect (and in-flight fetches) from writing one feed's rows into the
  // other feed's cache entry when followingOnly is toggled.
  const loadedKeyRef = useRef(cacheKey)

  // Feed switched (followingOnly toggled): synchronously swap local state
  // over to the new key's cache before any render or effect can write the
  // old feed's rows back under the new key.
  if (loadedKeyRef.current !== cacheKey) {
    loadedKeyRef.current = cacheKey
    const entry = feedCache.get(cacheKey)
    offsetRef.current = entry?.offset ?? 0
    setPhotos(entry?.photos ?? [])
    setHasMore(entry?.hasMore ?? true)
    setLoading(!entry)
    setError(null)
  }

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    const key = feedCacheKey(currentUserId, followingOnly)
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    try {
      let followingIds: string[] | null = null
      if (followingOnly && currentUserId) {
        const { data: follows, error: followErr } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId)
        if (followErr) throw new Error(followErr.message)
        followingIds = (follows ?? []).map((f: any) => f.following_id)
        if (followingIds.length === 0) {
          if (loadedKeyRef.current === key) {
            if (!append) setPhotos([])
            setHasMore(false)
          }
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
      // Stale response — the feed was switched while this fetch was in flight
      if (loadedKeyRef.current !== key) return

      const rows = (data ?? []) as GalleryPhoto[]
      setHasMore(rows.length === PAGE_SIZE)
      setPhotos(prev => {
        if (!append) return rows
        const seen = new Set(prev.map(p => p.photo_id))
        return [...prev, ...rows.filter(r => !seen.has(r.photo_id))]
      })
      offsetRef.current = offset + rows.length
      setError(null)
    } catch (e) {
      if (loadedKeyRef.current !== key) return
      if (append) {
        // Keep the already-loaded list — just tell the user paging failed
        toast.error("Couldn't load more")
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load gallery')
      }
    } finally {
      if (loadedKeyRef.current === key) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [currentUserId, followingOnly])

  useEffect(() => {
    // If this feed is already cached (returning via back nav), don't refetch —
    // the seeded state above already holds the full loaded list.
    if (feedCache.has(cacheKey)) return
    offsetRef.current = 0
    fetchPage(0, false)
  }, [fetchPage, cacheKey])

  // Keep the module cache in sync with local state (covers paging + optimistic
  // like/comment updates) so the next remount restores the latest list.
  useEffect(() => {
    if (loading) return
    // Only persist state that actually belongs to this key
    if (loadedKeyRef.current !== cacheKey) return
    feedCache.set(cacheKey, { photos, offset: offsetRef.current, hasMore })
  }, [photos, hasMore, loading, cacheKey])

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

    const { error: err } = wasLiked
      ? await supabase
          .from('review_likes')
          .delete()
          .match({ review_id: reviewId, user_id: currentUserId })
      : await supabase
          .from('review_likes')
          .insert({ review_id: reviewId, user_id: currentUserId })

    if (err) {
      setPhotos(prev =>
        prev.map(p =>
          p.review_id === reviewId
            ? { ...p, is_liked_by_me: wasLiked, like_count: prevLikeCount }
            : p
        )
      )
      toast.error('Could not update like')
    } else if (!wasLiked) {
      triggerPushDelivery()
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
    restoredFromCache: restoredFromCacheRef.current,
    loadMore,
    toggleLike,
    refreshReview,
    refreshPhoto,
  }
}
