import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  createReview as createReviewAction,
  updateReview as updateReviewAction,
  deleteReview as deleteReviewAction,
  type ReviewCreateData,
} from '../lib/reviewActions'
import type { SpotWithReviews, Review, WingSpot, ReviewUpdateData, ReviewPhoto } from '../lib/types'

interface UseReviewsReturn {
  spots: SpotWithReviews[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createReview: (data: ReviewCreateData, userId: string) => Promise<{ error: string | null; reviewId?: string }>
  updateReview: (reviewId: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  deleteReview: (reviewId: string) => Promise<{ error: string | null }>
}

/**
 * Builds the per-spot view: each spot with its reviews (newest visit first,
 * as given), their photos, and the average rating. Rated spots come first,
 * then alphabetical.
 */
export function groupSpots(wingSpots: WingSpot[], reviews: Review[], photos: ReviewPhoto[] = []): SpotWithReviews[] {
  // Index photos by review_id
  const photosByReview = new Map<string, ReviewPhoto[]>()
  for (const p of photos) {
    const list = photosByReview.get(p.review_id) ?? []
    list.push(p)
    photosByReview.set(p.review_id, list)
  }

  // Attach photos to reviews
  const reviewsWithPhotos = reviews.map(r => ({
    ...r,
    photos: photosByReview.get(r.id) ?? [],
  }))

  // Group reviews by spot
  const reviewsBySpot = new Map<string, Review[]>()
  for (const r of reviewsWithPhotos) {
    const list = reviewsBySpot.get(r.wing_spot_id) ?? []
    list.push(r)
    reviewsBySpot.set(r.wing_spot_id, list)
  }

  const result: SpotWithReviews[] = wingSpots.map(spot => {
    const spotReviews = reviewsBySpot.get(spot.id) ?? []
    const avgRating =
      spotReviews.length > 0
        ? spotReviews.reduce((s, r) => s + Number(r.overall_rating), 0) / spotReviews.length
        : 0
    // Collect all photos for this spot (newest first)
    const spotPhotos = spotReviews.flatMap(r => r.photos ?? [])
    return { spot, reviews: spotReviews, avg_rating: avgRating, photos: spotPhotos }
  })

  // Sort spots: those with reviews first, then by name
  result.sort((a, b) => {
    if (a.reviews.length === 0 && b.reviews.length > 0) return 1
    if (b.reviews.length === 0 && a.reviews.length > 0) return -1
    return a.spot.name.localeCompare(b.spot.name)
  })
  return result
}

/**
 * All spots with their reviews and photos (~350 KB): for the Spots and Map
 * views. `enabled: false` holds the download back (the feed doesn't need it,
 * and on a slow connection it delayed the feed's first photo, S26); it
 * starts the first time `enabled` is true. `loading` stays true until then.
 */
export function useReviews({ enabled = true }: { enabled?: boolean } = {}): UseReviewsReturn {
  const [spots, setSpots] = useState<SpotWithReviews[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  const fetchAll = useCallback(async () => {
    started.current = true
    setLoading(true)
    setError(null)

    try {
      const [spotRes, reviewRes, photoRes] = await Promise.all([
        supabase.from('wing_spots').select('*').order('name'),
        supabase.from('reviews_with_profiles').select('*').order('visited_at', { ascending: false }),
        supabase.from('review_photos').select('*').order('display_order'),
      ])

      if (spotRes.error) throw new Error(spotRes.error.message)
      if (reviewRes.error) throw new Error(reviewRes.error.message)
      // Photos errors are non-fatal — proceed without them

      const reviews = (reviewRes.data ?? []) as Review[]
      const wingSpots = (spotRes.data ?? []) as WingSpot[]
      const photos = (photoRes.data ?? []) as ReviewPhoto[]

      setSpots(groupSpots(wingSpots, reviews, photos))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled && !started.current) void fetchAll()
  }, [enabled, fetchAll])

  const createReview = async (data: ReviewCreateData, userId: string) => {
    const result = await createReviewAction(data, userId)
    // Refresh in the background: the form navigates to the new review, and
    // waiting for a full refetch kept the sheet on "Publishing…" for seconds
    // on a slow connection (m1 mobile 11). Not loaded yet: the first load
    // will include it.
    if (!result.error && started.current) void fetchAll()
    return result
  }

  const updateReview = async (reviewId: string, data: ReviewUpdateData) => {
    const result = await updateReviewAction(reviewId, data)
    if (!result.error) await fetchAll()
    return result
  }

  const deleteReview = async (reviewId: string) => {
    const result = await deleteReviewAction(reviewId)
    if (!result.error) await fetchAll()
    return result
  }

  return { spots, loading, error, refresh: fetchAll, createReview, updateReview, deleteReview }
}
