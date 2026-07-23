import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { GalleryPhoto, GalleryReviewItem } from '../lib/types'

function toReview(rows: GalleryPhoto[]): GalleryReviewItem {
  const first = rows[0]
  return {
    review_id: first.review_id,
    overall_rating: first.overall_rating,
    wing_flavor: first.wing_flavor,
    wing_flavors: first.wing_flavors,
    review_text: first.review_text,
    visited_at: first.visited_at,
    wing_spot_id: first.wing_spot_id,
    spot_name: first.spot_name,
    spot_slug: first.spot_slug,
    spot_address: first.spot_address,
    reviewer_id: first.reviewer_id,
    reviewer_name: first.reviewer_name,
    reviewer_username: first.reviewer_username,
    reviewer_avatar: first.reviewer_avatar,
    reviewer_email: first.reviewer_email,
    reviewer_is_private: first.reviewer_is_private,
    like_count: first.like_count,
    comment_count: first.comment_count,
    is_liked_by_me: first.is_liked_by_me,
    event_id: first.event_id,
    event_slug: first.event_slug,
    event_name: first.event_name,
    photos: rows.map(p => ({
      photo_id: p.photo_id,
      photo_url: p.photo_url,
      display_order: p.display_order,
      photo_created_at: p.photo_created_at,
    })),
  }
}

/**
 * Hook for opening a review's photos in PhotoModal from list/map views.
 * Fetches the tapped photo's whole review so the modal gets the full
 * swipeable carousel; falls back to just the tapped photo if the review
 * query fails. Likes operate at the review level.
 */
export function usePhotoDetail(currentUserId: string) {
  const [detail, setDetail] = useState<{ review: GalleryReviewItem; initialIndex: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const open = useCallback(async (photoId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('gallery_feed')
      .select('*')
      .eq('photo_id', photoId)
      .single()
    if (error || !data) {
      toast.error('Could not load photo')
      setDetail(null)
      setLoading(false)
      return
    }
    const tapped = data as GalleryPhoto
    const { data: siblings, error: reviewError } = await supabase
      .from('gallery_feed')
      .select('*')
      .eq('review_id', tapped.review_id)
      .order('display_order', { ascending: true })
    const rows = (reviewError || !siblings || siblings.length === 0)
      ? [tapped]
      : (siblings as GalleryPhoto[])
    setDetail({
      review: toReview(rows),
      initialIndex: Math.max(0, rows.findIndex(p => p.photo_id === photoId)),
    })
    setLoading(false)
  }, [])

  const close = useCallback(() => setDetail(null), [])

  const toggleLike = useCallback(async () => {
    if (!detail) return
    const { review } = detail
    const wasLiked = review.is_liked_by_me
    setDetail(d => d ? {
      ...d,
      review: {
        ...d.review,
        is_liked_by_me: !wasLiked,
        like_count: wasLiked ? d.review.like_count - 1 : d.review.like_count + 1,
      },
    } : d)
    const { error } = wasLiked
      ? await supabase.from('review_likes').delete().match({ review_id: review.review_id, user_id: currentUserId })
      : await supabase.from('review_likes').insert({ review_id: review.review_id, user_id: currentUserId })

    if (error) {
      setDetail(d => d ? {
        ...d,
        review: { ...d.review, is_liked_by_me: wasLiked, like_count: review.like_count },
      } : d)
      toast.error('Could not update like')
    } else if (!wasLiked) {
      triggerPushDelivery()
    }
  }, [detail, currentUserId])

  const onCommentAdded = useCallback(() => {
    setDetail(d => d ? { ...d, review: { ...d.review, comment_count: d.review.comment_count + 1 } } : d)
  }, [])

  return {
    review: detail?.review ?? null,
    initialIndex: detail?.initialIndex ?? 0,
    loading,
    open,
    close,
    toggleLike,
    onCommentAdded,
  }
}
