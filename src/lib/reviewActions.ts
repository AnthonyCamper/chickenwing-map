import toast from 'react-hot-toast'
import { supabase } from './supabase'
import { downscaleImage, imageExtension } from './imageResize'
import { triggerPushDelivery } from './pushManager'
import { announceNewBadges, snapshotEarnedBadgeIds } from './badgeUnlocks'
import { SIGNED_OUT_ERROR, looksSignedOut } from './publishErrors'
import { invalidateGalleryFeedCache } from '../hooks/useGallery'
import { findExistingSpot } from './spotMatch'
import type { ReviewFormData, ReviewUpdateData } from './types'

// Review ids are UUIDs. Anything else can't exist, and sending it to
// Postgres returns a 400 (invalid uuid), so callers treat it as not-found.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value)
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
 * Downscale and upload one photo, then record it in review_photos.
 * GIFs, small files and anything the browser can't re-encode are uploaded
 * as-is (see downscaleImage). If the DB insert fails, the freshly uploaded
 * storage object is removed again. Returns true on success.
 */
async function uploadReviewPhoto(
  file: File,
  userId: string,
  reviewId: string,
  displayOrder: number
): Promise<boolean> {
  const blob = await downscaleImage(file)
  const contentType = blob.type || 'image/jpeg'
  const ext = imageExtension(blob)

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

/**
 * A write failed: was it because the session is gone? Checks the error text
 * first, then whether the client still holds a session at all (signing out
 * in another tab clears it, and the write then fails as an RLS refusal).
 */
async function signedOutError(message: string | null | undefined): Promise<boolean> {
  if (looksSignedOut(message)) return true
  try {
    const { data, error } = await supabase.auth.getSession()
    return !error && !data.session
  } catch {
    return false
  }
}

function toastFailedUploads(failed: number) {
  if (failed > 0) {
    toast.error(`${failed} photo${failed === 1 ? '' : 's'} failed to upload`)
  }
}

/**
 * What the review form sends. `wing_spot_id` is set when the user picked a
 * spot that's already on the site (a suggestion, the spot page, an event
 * stop): the review goes straight onto that spot, no name lookup (m2 S03).
 */
export type ReviewCreateData = ReviewFormData & { wing_spot_id?: string | null }

/**
 * The spot a new review belongs to: the picked one, else an existing spot
 * with the same name + address (case/whitespace-tolerant), else a new spot.
 */
async function resolveSpotId(
  data: ReviewCreateData
): Promise<{ id: string | null; error: { message: string; code?: string } | null }> {
  if (isUuid(data.wing_spot_id)) {
    const { data: row, error } = await supabase
      .from('wing_spots')
      .select('id')
      .eq('id', data.wing_spot_id)
      .maybeSingle()
    if (error) return { id: null, error }
    // Gone since it was picked (deleted by an admin): fall back to the lookup.
    if (row) return { id: (row as { id: string }).id, error: null }
  }

  // Reuse an existing spot by name+address without touching its coordinates.
  // The old upsert (ignoreDuplicates: false) let any reviewer move an
  // existing spot just by submitting different lat/lng for the same name.
  const spotName = data.shop_name.trim()
  const spotAddress = data.address.trim()
  const near = { lat: parseFloat(data.lat), lng: parseFloat(data.lng) }
  const found = await findExistingSpot(spotName, spotAddress, near)
  if (found.error) return { id: null, error: found.error }
  if (found.spot) return { id: found.spot.id, error: null }

  const inserted = await supabase
    .from('wing_spots')
    .insert({ name: spotName, address: spotAddress, lat: parseFloat(data.lat), lng: parseFloat(data.lng) })
    .select('id')
    .single()
  if (inserted.data) return { id: (inserted.data as { id: string }).id, error: null }
  // Lost a race with someone adding the same spot: use theirs.
  if (inserted.error?.code === '23505') {
    const again = await findExistingSpot(spotName, spotAddress, near)
    if (again.spot) return { id: again.spot.id, error: null }
  }
  return { id: null, error: inserted.error }
}

export async function createReview(
  data: ReviewCreateData,
  userId: string
): Promise<{ error: string | null; reviewId?: string }> {
  // DB triggers award badges on the insert below — snapshot first so we can
  // diff afterwards and celebrate any new unlocks.
  const earnedBefore = await snapshotEarnedBadgeIds()

  const { id: spotId, error: spotErr } = await resolveSpotId(data)
  if (spotErr || !spotId) {
    if (await signedOutError(spotErr?.message)) return { error: SIGNED_OUT_ERROR }
    return { error: spotErr?.message ?? 'Could not create wing spot' }
  }

  const { data: reviewData, error: reviewErr } = await supabase
    .from('reviews')
    .insert({
      wing_spot_id: spotId,
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
    if (await signedOutError(reviewErr?.message)) return { error: SIGNED_OUT_ERROR }
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
    if (err) {
      // Callers show this text as-is in a toast, so keep it readable.
      if (await signedOutError(err.message)) {
        return { error: "You've been signed out. Sign in again to save your changes." }
      }
      return { error: "Couldn't save your changes. Check your connection and try again." }
    }
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
