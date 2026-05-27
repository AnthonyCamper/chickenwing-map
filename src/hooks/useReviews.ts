import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  createReview as createReviewAction,
  updateReview as updateReviewAction,
  deleteReview as deleteReviewAction,
} from '../lib/reviewActions'
import type { SpotWithReviews, Review, WingSpot, ReviewFormData, ReviewUpdateData, ReviewPhoto } from '../lib/types'

interface UseReviewsReturn {
  spots: SpotWithReviews[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createReview: (data: ReviewFormData, userId: string) => Promise<{ error: string | null; reviewId?: string }>
  updateReview: (reviewId: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  deleteReview: (reviewId: string) => Promise<{ error: string | null }>
}

export function useReviews(): UseReviewsReturn {
  const [spots, setSpots] = useState<SpotWithReviews[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
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

      setSpots(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const createReview = async (data: ReviewFormData, userId: string) => {
    const result = await createReviewAction(data, userId)
    if (!result.error) await fetchAll()
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
