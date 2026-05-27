import { supabase } from './supabase'
import { triggerPushDelivery } from './pushManager'
import type { ReviewFormData, ReviewUpdateData } from './types'

export async function compressImage(file: File): Promise<Blob> {
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

export async function createReview(
  data: ReviewFormData,
  userId: string
): Promise<{ error: string | null; reviewId?: string }> {
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
      event_id: data.event_id ?? null,
      event_stop_id: data.event_stop_id ?? null,
    })
    .select('id')
    .single()

  if (reviewErr || !reviewData) {
    return { error: reviewErr?.message ?? 'Could not create review' }
  }

  if (data.photos?.length) {
    for (let i = 0; i < data.photos.length; i++) {
      try {
        const file = data.photos[i]
        const compressed = await compressImage(file)
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
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

  triggerPushDelivery()
  return { error: null, reviewId: reviewData.id }
}

export async function updateReview(
  reviewId: string,
  data: ReviewUpdateData
): Promise<{ error: string | null }> {
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

  if (data.photos_to_delete?.length) {
    const { data: photosData } = await supabase
      .from('review_photos')
      .select('id, storage_path')
      .in('id', data.photos_to_delete)

    if (photosData?.length) {
      const paths = photosData.map(p => p.storage_path)
      await supabase.storage.from('review-photos').remove(paths)
      await supabase.from('review_photos').delete().in('id', data.photos_to_delete)
    }
  }

  if (data.new_photos?.length) {
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id
    if (userId) {
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

  return { error: null }
}

export async function deleteReview(reviewId: string): Promise<{ error: string | null }> {
  const { error: err } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
  if (err) return { error: err.message }
  return { error: null }
}
