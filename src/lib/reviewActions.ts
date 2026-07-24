import toast from 'react-hot-toast'
import { supabase } from './supabase'
import { triggerPushDelivery } from './pushManager'
import { announceNewBadges, snapshotEarnedBadgeIds } from './badgeUnlocks'
import { invalidateGalleryFeedCache } from '../hooks/useGallery'
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

/**
 * reviews.wing_flavors is the source of truth; wing_flavor is the legacy
 * column, comma-joined for multi-flavor rows. Derive the array form so both
 * columns stay in sync on every write.
 */
function toFlavorArray(flavor: string | undefined | null): string[] {
  const trimmed = flavor?.trim()
  if (!trimmed) return []
  return trimmed.split(', ').map(f => f.trim()).filter(Boolean)
}

/**
 * Compress and upload one photo, then record it in review_photos.
 * If the canvas can't decode the file (e.g. HEIC outside Safari) the original
 * file is uploaded as-is. If the DB insert fails, the freshly uploaded storage
 * object is removed again. Returns true on success.
 */
async function uploadReviewPhoto(
  file: File,
  userId: string,
  reviewId: string,
  displayOrder: number
): Promise<boolean> {
  let blob: Blob = file
  let contentType = file.type || 'image/jpeg'
  let ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  try {
    blob = await compressImage(file)
    contentType = 'image/jpeg'
    ext = 'jpg'
  } catch {
    // Fall back to uploading the original file untouched
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = `${userId}/${reviewId}/${filename}`

  const { error: uploadErr } = await supabase.storage
    .from('review-photos')
    .upload(path, blob, { contentType })
  if (uploadErr) return false

  const { data: { publicUrl } } = supabase.storage
    .from('review-photos')
    .getPublicUrl(path)

  const { error: insertErr } = await supabase.from('review_photos').insert({
    review_id: reviewId,
    storage_path: path,
    url: publicUrl,
    display_order: displayOrder,
  })
  if (insertErr) {
    // Don't leave an orphaned object the review will never reference
    await supabase.storage.from('review-photos').remove([path])
    return false
  }
  return true
}

function toastFailedUploads(failed: number) {
  if (failed > 0) {
    toast.error(`${failed} photo${failed === 1 ? '' : 's'} failed to upload`)
  }
}

export async function createReview(
  data: ReviewFormData,
  userId: string
): Promise<{ error: string | null; reviewId?: string }> {
  // DB triggers award badges on the insert below — snapshot first so we can
  // diff afterwards and celebrate any new unlocks.
  const earnedBefore = await snapshotEarnedBadgeIds()

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
      wing_flavors: toFlavorArray(data.wing_flavor),
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
    let failed = 0
    for (let i = 0; i < data.photos.length; i++) {
      const ok = await uploadReviewPhoto(data.photos[i], userId, reviewData.id, i)
      if (!ok) failed++
    }
    toastFailedUploads(failed)
  }

  invalidateGalleryFeedCache()
  triggerPushDelivery()
  void announceNewBadges(earnedBefore)
  return { error: null, reviewId: reviewData.id }
}

export async function updateReview(
  reviewId: string,
  data: ReviewUpdateData
): Promise<{ error: string | null }> {
  // Rating/flavor edits can also newly qualify for badges — same
  // snapshot/diff dance as createReview.
  const earnedBefore = await snapshotEarnedBadgeIds()

  const updates: Record<string, unknown> = {}
  if (data.overall_rating !== undefined) updates.overall_rating = data.overall_rating
  if (data.wing_size !== undefined) updates.wing_size = data.wing_size.trim() || null
  if (data.wing_flavor !== undefined) {
    updates.wing_flavor = data.wing_flavor.trim() || null
    updates.wing_flavors = toFlavorArray(data.wing_flavor)
  }
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

      let failed = 0
      for (const file of data.new_photos) {
        const ok = await uploadReviewPhoto(file, userId, reviewId, nextOrder++)
        if (!ok) failed++
      }
      toastFailedUploads(failed)
    }
  }

  invalidateGalleryFeedCache()
  void announceNewBadges(earnedBefore)
  return { error: null }
}

export async function deleteReview(reviewId: string): Promise<{ error: string | null }> {
  // Remove storage objects first — once the row cascade-deletes there's no
  // record of the paths left to clean up. Removal failure is non-fatal.
  const { data: photos } = await supabase
    .from('review_photos')
    .select('storage_path')
    .eq('review_id', reviewId)
  if (photos?.length) {
    await supabase.storage
      .from('review-photos')
      .remove(photos.map(p => p.storage_path))
  }

  const { error: err } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
  if (err) return { error: err.message }

  invalidateGalleryFeedCache()
  return { error: null }
}
