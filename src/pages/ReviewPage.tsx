import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { updateReview as updateReviewAction, deleteReview as deleteReviewAction } from '../lib/reviewActions'
import ReviewCard from '../components/ReviewCard'
import PhotoLightbox from '../components/ui/PhotoLightbox'
import AppHeader from '../components/AppHeader'
import PageStateShell from '../components/ui/PageStateShell'
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
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<ReviewDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!id) return

    const { data: review, error } = await supabase
      .from('reviews_with_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) { setStatus('error'); return }
    if (!review) { setStatus('not-found'); return }

    const [{ data: photos }, { data: spot }, { data: { session } }, { data: otherReviews }] = await Promise.all([
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
    ])

    setCurrentUserId(session?.user?.id ?? '')
    setData({
      review: { ...(review as Review), photos: (photos ?? []) as ReviewPhoto[] },
      spot: (spot as WingSpot | null) ?? null,
      moreByAuthor: (otherReviews ?? []) as OtherReview[],
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
      <PageStateShell>
        <p className="eyebrow">404</p>
        <h1 className="font-display uppercase text-3xl text-night-900">No review here</h1>
        <Link to="/" className="btn-secondary">Back home</Link>
      </PageStateShell>
    )
  }

  if (status === 'error' || !data) {
    return (
      <PageStateShell>
        <h1 className="font-display uppercase text-3xl text-night-900">Something broke</h1>
        <Link to="/" className="btn-secondary">Back home</Link>
      </PageStateShell>
    )
  }

  const { review, spot, moreByAuthor } = data
  const authorName = review.reviewer_is_private ? 'Private wing-logger' : (review.reviewer_name ?? 'Anonymous')
  const rating = Number(review.overall_rating).toFixed(1)
  const title = spot
    ? `${rating}/10 review of ${spot.name} by ${authorName} — WingKingTony`
    : `${rating}/10 wing review by ${authorName} — WingKingTony`
  const description = review.review_text?.trim()
    ? review.review_text.trim().slice(0, 200)
    : `${authorName} rated ${spot?.name ?? 'this spot'} ${rating}/10${review.wing_flavor ? ` (${review.wing_flavor})` : ''}.`
  const coverPhoto = review.photos?.[0]?.url

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
              className="block font-display uppercase text-3xl md:text-4xl text-night-900 leading-none tracking-tightest hover:text-sauce-500"
            >
              {spot.name}
            </Link>
          )}
          {spot?.address && <p className="text-xs text-charcoal-500 mt-1">{spot.address}</p>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 pb-safe-8">
        <div className="bg-cream-50 border-2 border-night-900 rounded-xl shadow-sticker px-5">
          <ReviewCard
            review={review}
            currentUserId={currentUserId}
            isAdmin={false}
            onUpdate={handleUpdate}
            onDelete={async (rid) => {
              const res = await handleDelete(rid)
              if (res.error) toast.error(res.error)
              return res
            }}
          />
        </div>

        {review.photos && review.photos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            {review.photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="w-full overflow-hidden rounded-xl border-2 border-night-900 shadow-sticker-sm hover:shadow-sticker transition-shadow"
              >
                <img src={p.url} alt="" loading="lazy" className="w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-2 text-xs">
          {review.wing_size && (
            <span className="px-2 py-1 bg-cream-100 border-2 border-night-900 rounded font-bold uppercase tracking-crowd text-night-900">
              {review.wing_size}
            </span>
          )}
          {review.is_takeout && (
            <span className="px-2 py-1 bg-cream-100 border-2 border-night-900 rounded font-bold uppercase tracking-crowd text-night-900">
              Takeout{review.takeout_container ? ` · ${review.takeout_container}` : ''}
            </span>
          )}
        </div>

        {moreByAuthor.length > 0 && !review.reviewer_is_private && (
          <section className="mt-12">
            <h2 className="eyebrow mb-3">
              More from {review.reviewer_name ?? 'this wing-logger'}
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
                      <p className="font-display uppercase text-sm text-night-900 truncate">{o.spot_name ?? 'Unknown spot'}</p>
                      <p className="text-[10px] text-charcoal-500">
                        {(() => { try { return format(new Date(o.visited_at), 'MMM d, yyyy') } catch { return o.visited_at } })()}
                      </p>
                    </div>
                    <span className="font-display text-lg text-night-900 shrink-0">{Number(o.overall_rating).toFixed(1)}</span>
                  </div>
                </Link>
              ))}
            </div>
            {review.reviewer_username && (
              <div className="mt-3">
                <Link to={`/u/${review.reviewer_username}`} className="text-xs text-sauce-500 hover:underline">
                  See all reviews →
                </Link>
              </div>
            )}
          </section>
        )}
      </main>

      {lightboxIndex !== null && review.photos && review.photos.length > 0 && (
        <PhotoLightbox
          photos={review.photos.map(p => ({ id: p.id, url: p.url }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
