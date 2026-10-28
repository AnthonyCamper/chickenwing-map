import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { formatVisitDate } from '../lib/dates'
import { cleanUserText } from '../lib/userText'
import { updateReview as updateReviewAction, deleteReview as deleteReviewAction, isUuid } from '../lib/reviewActions'
import ReviewCard from '../components/ReviewCard'
import PhotoLightbox from '../components/ui/PhotoLightbox'
import AppHeader from '../components/AppHeader'
import PageStateShell from '../components/ui/PageStateShell'
import ShareButton from '../components/ui/ShareButton'
import { useAuthContext } from '../components/AuthProvider'
import type { Review, ReviewPhoto, WingSpot, ReviewUpdateData } from '../lib/types'

interface OtherReview {
  id: string
  overall_rating: number
  visited_at: string
  spot_name: string | null
  spot_slug: string | null
}

interface ReviewDetail {
  review: Review
  spot: WingSpot | null
  moreByAuthor: OtherReview[]
  commentCount: number
}

/** `#comment-<uuid>` (notification deep link) → the comment id. */
function commentIdFromHash(hash: string): string | null {
  const m = hash.match(/^#comment-(.+)$/)
  return m && isUuid(m[1]) ? m[1] : null
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData] = useState<ReviewDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const auth = useAuthContext()

  // Notification deep link: /reviews/<id>#comment-<commentId>. Look up
  // whether it's a reply (and to which comment) so the card can open the
  // comments, expand that thread and scroll to it.
  const hashCommentId = commentIdFromHash(location.hash)
  const [focusComment, setFocusComment] = useState<{ id: string; parentId: string | null; key: string } | null>(null)
  useEffect(() => {
    if (!hashCommentId) { setFocusComment(null); return }
    let cancelled = false
    supabase
      .from('review_comments')
      .select('parent_comment_id')
      .eq('id', hashCommentId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setFocusComment({
          id: hashCommentId,
          parentId: (data as { parent_comment_id: string | null } | null)?.parent_comment_id ?? null,
          key: location.key,
        })
      })
    return () => { cancelled = true }
  }, [hashCommentId, location.key])

  const load = useCallback(async () => {
    // A malformed id can't match anything — show the 404, not an error.
    if (!isUuid(id)) { setStatus('not-found'); return }

    const { data: review, error } = await supabase
      .from('reviews_with_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    // 22P02 = invalid text representation (malformed id) → it's a 404, not a crash
    if (error) { setStatus(error.code === '22P02' ? 'not-found' : 'error'); return }
    if (!review) { setStatus('not-found'); return }

    const [{ data: photos }, { data: spot }, { data: { session } }, { data: otherReviews }, { count: commentCount }] = await Promise.all([
      supabase.from('review_photos').select('*').eq('review_id', review.id).order('display_order'),
      supabase.from('wing_spots').select('*').eq('id', review.wing_spot_id).maybeSingle(),
      supabase.auth.getSession(),
      supabase
        .from('reviews_with_profiles')
        .select('id, overall_rating, visited_at, spot_name, spot_slug')
        .eq('user_id', review.user_id)
        .neq('id', review.id)
        .order('visited_at', { ascending: false })
        .limit(4),
      // Same source as SpotPage: every comment row, replies included.
      supabase
        .from('review_comments')
        .select('id', { count: 'exact', head: true })
        .eq('review_id', review.id),
    ])

    setCurrentUserId(session?.user?.id ?? '')
    setData({
      review: { ...(review as Review), photos: (photos ?? []) as ReviewPhoto[] },
      spot: (spot as WingSpot | null) ?? null,
      moreByAuthor: (otherReviews ?? []) as OtherReview[],
      commentCount: commentCount ?? 0,
    })
    setStatus('ready')
  }, [id])

  useEffect(() => {
    setStatus('loading')
    load()
  }, [load])

  const handleUpdate = useCallback(async (rid: string, data: ReviewUpdateData) => {
    const result = await updateReviewAction(rid, data)
    if (!result.error) await load()
    return result
  }, [load])

  const handleDelete = useCallback(async (rid: string) => {
    const result = await deleteReviewAction(rid)
    if (!result.error) navigate('/')
    return result
  }, [load, navigate])

  if (status === 'loading') {
    return (
      <PageStateShell>
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      </PageStateShell>
    )
  }

  if (status === 'not-found') {
    return (
      <PageStateShell title="Review not found — WingKingTony">
        <p className="eyebrow">404</p>
        <h1 className="font-display uppercase text-3xl text-night-900">Review not found</h1>
        <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed">
          This review doesn't exist or was deleted. Check the link and try again.
        </p>
        <Link to="/" className="btn-secondary">Back home</Link>
      </PageStateShell>
    )
  }

  if (status === 'error' || !data) {
    return (
      <PageStateShell>
        <h1 className="font-display uppercase text-3xl text-night-900">Couldn't load this review</h1>
        <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed">
          Check your connection and try again.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => { setStatus('loading'); load() }} className="btn-primary">Try again</button>
          <Link to="/" className="btn-secondary">Back home</Link>
        </div>
      </PageStateShell>
    )
  }

  const { review, spot, moreByAuthor, commentCount } = data
  // Private profiles hide the profile page, not the name on public reviews
  // (Privacy policy). Their profile link and "More from" list stay hidden.
  const isOwnReview = !!currentUserId && review.user_id === currentUserId
  const showAuthorProfile = !review.reviewer_is_private || isOwnReview
  const authorName = cleanUserText(review.reviewer_name) || 'Anonymous'
  const spotName = spot ? cleanUserText(spot.name) : null
  const rating = Number(review.overall_rating).toFixed(1)
  const title = spot
    ? `${rating}/10 review of ${spotName} by ${authorName} — WingKingTony`
    : `${rating}/10 wing review by ${authorName} — WingKingTony`
  const description = review.review_text?.trim()
    ? review.review_text.trim().slice(0, 200)
    : `${authorName} rated ${spotName ?? 'this spot'} ${rating}/10${review.wing_flavor ? ` (${review.wing_flavor})` : ''}.`
  const coverPhoto = review.photos?.[0]?.url
  const photos = review.photos ?? []
  const photoAlt = (i: number) => {
    const where = spotName ? ` at ${spotName}` : ''
    return photos.length > 1
      ? `Photo ${i + 1} of ${photos.length}: wings${where}, from ${authorName}'s review`
      : `Photo of wings${where}, from ${authorName}'s review`
  }

  // Photos and takeout info live INSIDE the review card, under the text —
  // never below the page navigation, where they looked like a failed upload.
  const reviewMedia = (photos.length > 0 || review.is_takeout) ? (
    <div className="mb-3 space-y-3">
      {photos.length > 0 && (
        <div className={`grid gap-2 ${photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightboxIndex(i)}
              aria-label={`Open photo ${i + 1} of ${photos.length} full size`}
              className={`w-full overflow-hidden rounded-xl border-2 border-night-900 bg-cream-200 hover:border-sauce-400 transition-colors ${
                photos.length > 1 ? 'aspect-square' : 'aspect-[4/3]'
              }`}
            >
              <img src={p.url} alt={photoAlt(i)} loading={i < 2 ? 'eager' : 'lazy'} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {/* Wing size is shown in the card header (ReviewCard) */}
      {review.is_takeout && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-cream-100 border-2 border-night-900 rounded font-bold uppercase tracking-crowd text-night-900">
            Takeout{review.takeout_container ? ` · ${review.takeout_container.replace(/_/g, ' ')}` : ''}
          </span>
        </div>
      )}
    </div>
  ) : null

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {coverPhoto && <meta property="og:image" content={coverPhoto} />}
        <meta property="og:type" content="article" />
        <link rel="canonical" href={`https://wingkingtony.com/reviews/${review.id}`} />
      </Helmet>

      <AppHeader />

      <header className="border-b-2 border-night-900 bg-cream-100">
        <div className="max-w-2xl mx-auto px-5 py-6">
          {spot && (
            <Link
              to={`/spots/${spot.slug ?? ''}`}
              className="block font-display uppercase text-3xl md:text-4xl text-night-900 leading-none tracking-tightest hover:text-sauce-500 break-words user-text"
            >
              {spotName}
            </Link>
          )}
          {spot?.address && <p className="text-xs text-charcoal-500 mt-1 break-words user-text">{cleanUserText(spot.address)}</p>}
          <div className="mt-3">
            <ShareButton
              title={title}
              text={spot ? `A ${rating}/10 wing review of ${spotName}` : 'A wing review on WingKingTony'}
              url={`${window.location.origin}/reviews/${review.id}`}
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 pb-safe-8">
        <div className="bg-cream-50 border-2 border-night-900 rounded-xl shadow-sticker px-5">
          <ReviewCard
            review={review}
            currentUserId={currentUserId}
            isAdmin={auth?.isAdmin ?? false}
            commentCount={commentCount}
            media={reviewMedia}
            focusComment={focusComment}
            onUpdate={handleUpdate}
            onDelete={async (rid) => {
              const res = await handleDelete(rid)
              if (res.error) toast.error(res.error)
              return res
            }}
          />
        </div>

        {/* Landing here straight after publishing shouldn't be a dead end.
            The new review is on Discover (Following only shows people you
            follow), so that's where "back to the feed" goes. */}
        <nav aria-label="Next steps" className="mt-4 flex flex-wrap gap-2">
          <Link to="/?tab=discover" className="btn-secondary min-h-[44px]">← Back to the feed</Link>
          {spot?.slug && (
            <Link to={`/spots/${spot.slug}`} className="btn-ghost min-h-[44px] user-text">See all reviews of {spotName}</Link>
          )}
        </nav>

        {moreByAuthor.length > 0 && showAuthorProfile && (
          <section className="mt-12">
            <h2 className="eyebrow mb-3 truncate user-text">
              More from {authorName}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {moreByAuthor.map(o => (
                <Link
                  key={o.id}
                  to={`/reviews/${o.id}`}
                  className="block bg-cream-50 border-2 border-night-900 rounded-lg px-3 py-2.5 shadow-sticker-sm hover:shadow-sticker transition-shadow"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display uppercase text-sm text-night-900 truncate user-text">{cleanUserText(o.spot_name) || 'Unknown spot'}</p>
                      <p className="text-[10px] text-charcoal-500">
                        {formatVisitDate(o.visited_at)}
                      </p>
                    </div>
                    <span className="font-display text-lg text-night-900 shrink-0">{Number(o.overall_rating).toFixed(1)}</span>
                  </div>
                </Link>
              ))}
            </div>
            {review.reviewer_username && (
              <div className="mt-3">
                <Link to={`/u/${review.reviewer_username}`} className="inline-flex items-center min-h-[44px] text-xs text-sauce-500 hover:underline">
                  See all reviews →
                </Link>
              </div>
            )}
          </section>
        )}
      </main>

      {lightboxIndex !== null && review.photos && review.photos.length > 0 && (
        <PhotoLightbox
          photos={review.photos.map((p, i) => ({ id: p.id, url: p.url, alt: photoAlt(i) }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
