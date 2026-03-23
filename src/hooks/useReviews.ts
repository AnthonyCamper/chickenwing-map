import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { SpotWithReviews, Review, WingSpot, ReviewFormData, ReviewUpdateData, ReviewPhoto } from '../lib/types'

interface UseReviewsReturn {
  spots: SpotWithReviews[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createReview: (data: ReviewFormData, userId: string) => Promise<{ error: string | null }>
  updateReview: (reviewId: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  deleteReview: (reviewId: string) => Promise<{ error: string | null }>
}

async function compressImage(file: File): Promise<Blob> {
  const MAX_WIDTH = 1200
  const QUALITY = 0.85
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_WIDTH / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Compression failed')),
        'image/jpeg',
        QUALITY
      )
    }
    img.onerror = reject
    img.src = url
  })
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

  const createReview = async (
    data: ReviewFormData,
    userId: string
  ): Promise<{ error: string | null }> => {
    // Upsert wing spot (match by name + address)
    const { data: spotData, error: spotErr } = await supabase
      .from('wing_spots')
      .upsert(
        {
          name: data.shop_name.trim(),
          address: data.address.trim(),
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lng),
        },
        { onConflict: 'name,address', ignoreDuplicates: false }
      )
      .select('id')
      .single()

    if (spotErr || !spotData) {
      return { error: spotErr?.message ?? 'Could not create wing spot' }
    }

    const { data: reviewData, error: reviewErr } = await supabase
      .from('reviews')
      .insert({
        wing_spot_id: spotData.id,
        overall_rating: data.overall_rating,
        wing_size: data.wing_size?.trim() || null,
        wing_flavor: data.wing_flavor?.trim() || null,
        is_takeout: data.is_takeout,
        takeout_container: data.takeout_container?.trim() || null,
        review_text: data.review_text?.trim() || null,
        visited_at: data.visited_at,
      })
      .select('id')
      .single()

    if (reviewErr || !reviewData) {
      return { error: reviewErr?.message ?? 'Could not create review' }
    }

    // Upload photos
    if (data.photos?.length) {
      for (let i = 0; i < data.photos.length; i++) {
        try {
          const file = data.photos[i]
          const compressed = await compressImage(file)
          const ext = 'jpg'
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const path = `${userId}/${reviewData.id}/${filename}`

          const { error: uploadErr } = await supabase.storage
            .from('review-photos')
            .upload(path, compressed, { contentType: 'image/jpeg' })

          if (!uploadErr) {
            const { data: { publicUrl } } = supabase.storage
              .from('review-photos')
              .getPublicUrl(path)

            await supabase.from('review_photos').insert({
              review_id: reviewData.id,
              storage_path: path,
              url: publicUrl,
              display_order: i,
            })
          }
        } catch {
          // Non-fatal — continue uploading remaining photos
        }
      }
    }

    await fetchAll()
    // Trigger push delivery for the new review notification
    triggerPushDelivery()
    return { error: null }
  }

  const updateReview = async (
    reviewId: string,
    data: ReviewUpdateData
  ): Promise<{ error: string | null }> => {
    // 1. Update review fields
    const updates: Record<string, unknown> = {}
    if (data.overall_rating !== undefined) updates.overall_rating = data.overall_rating
    if (data.wing_size !== undefined) updates.wing_size = data.wing_size.trim() || null
    if (data.wing_flavor !== undefined) updates.wing_flavor = data.wing_flavor.trim() || null
    if (data.is_takeout !== undefined) updates.is_takeout = data.is_takeout
    if (data.takeout_container !== undefined) updates.takeout_container = data.takeout_container.trim() || null
    if (data.review_text !== undefined) updates.review_text = data.review_text.trim() || null
    if (data.visited_at !== undefined) updates.visited_at = data.visited_at

    if (Object.keys(updates).length > 0) {
      const { error: err } = await supabase
        .from('reviews')
        .update(updates)
        .eq('id', reviewId)

      if (err) return { error: err.message }
    }

    // 2. Delete photos marked for removal
    if (data.photos_to_delete?.length) {
      // Fetch storage paths for the photos being deleted
      const { data: photosData } = await supabase
        .from('review_photos')
        .select('id, storage_path')
        .in('id', data.photos_to_delete)

      if (photosData?.length) {
        const paths = photosData.map(p => p.storage_path)
        // Remove from storage (non-fatal)
        await supabase.storage.from('review-photos').remove(paths)
        // Remove DB rows
        await supabase.from('review_photos').delete().in('id', data.photos_to_delete)
      }
    }

    // 3. Upload new photos
    if (data.new_photos?.length) {
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id
      if (userId) {
        // Determine next display_order
        const { data: existing } = await supabase
          .from('review_photos')
          .select('display_order')
          .eq('review_id', reviewId)
          .order('display_order', { ascending: false })
          .limit(1)
        let nextOrder = existing?.[0]?.display_order != null
          ? existing[0].display_order + 1
          : 0

        for (const file of data.new_photos) {
          try {
            const compressed = await compressImage(file)
            const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
            const path = `${userId}/${reviewId}/${filename}`

            const { error: uploadErr } = await supabase.storage
              .from('review-photos')
              .upload(path, compressed, { contentType: 'image/jpeg' })

            if (!uploadErr) {
              const { data: { publicUrl } } = supabase.storage
                .from('review-photos')
                .getPublicUrl(path)

              await supabase.from('review_photos').insert({
                review_id: reviewId,
                storage_path: path,
                url: publicUrl,
                display_order: nextOrder++,
              })
            }
          } catch {
            // Non-fatal — continue uploading remaining photos
          }
        }
      }
    }

    await fetchAll()
    return { error: null }
  }

  const deleteReview = async (reviewId: string): Promise<{ error: string | null }> => {
    const { error: err } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId)

    if (err) return { error: err.message }
    await fetchAll()
    return { error: null }
  }

  return { spots, loading, error, refresh: fetchAll, createReview, updateReview, deleteReview }
}
