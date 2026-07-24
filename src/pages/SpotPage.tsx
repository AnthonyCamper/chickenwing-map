import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import {
  createReview as createReviewAction,
  updateReview as updateReviewAction,
  deleteReview as deleteReviewAction,
} from '../lib/reviewActions'
import ReviewCard from '../components/ReviewCard'
import ReviewFormModal from '../components/ReviewFormModal'
import PhotoLightbox from '../components/ui/PhotoLightbox'
import ShareButton from '../components/ui/ShareButton'
import AppHeader from '../components/AppHeader'
import PageStateShell from '../components/ui/PageStateShell'
import { useAuthGate } from '../components/AuthGateModal'
import { useAuthContext } from '../components/AuthProvider'
import type { WingSpot, Review, ReviewPhoto, ReviewUpdateData, ReviewFormData } from '../lib/types'

interface SpotDetail {
  spot: WingSpot
  reviews: Review[]
  avgRating: number | null
}

function SpotMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || el.dataset.leafletInit) return
    el.dataset.leafletInit = '1'

    import('leaflet').then(L => {
      const map = L.map(el, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
        // One-finger drags trap vertical page scrolling on mobile.
        dragging: !L.Browser.mobile,
      })
      map.setView([lat, lng], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)
      const icon = L.divIcon({
        html: `<div style="width:32px;height:32px;border-radius:50%;background:#fa5a2e;color:white;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">🍗</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        className: '',
      })
      L.marker([lat, lng], { icon, title: name }).addTo(map)
    })
  }, [lat, lng, name])

  return <div ref={ref} className="w-full h-48 sm:h-56 rounded-xl border-2 border-night-900 overflow-hidden shadow-sticker" />
}

export default function SpotPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<SpotDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [lightbox, setLightbox] = useState<{ photos: ReviewPhoto[]; index: number } | null>(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const { requireAuth } = useAuthGate()
  const auth = useAuthContext()

  // Same gate Home uses for its FAB — signed-in users still need the
  // can_leave_reviews flag before the form opens.
  const handleLogWing = () => {
    if (!requireAuth()) return
    if (!auth?.canLeaveReviews) {
      toast.error("the admin hasn't enabled reviews for your account yet.")
      return
    }
    setShowLogModal(true)
  }

  const load = useCallback(async () => {
    if (!slug) return

    const { data: spot, error: spotErr } = await supabase
      .from('wing_spots')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()

    if (spotErr) { setStatus('error'); return }
    if (!spot) { setStatus('not-found'); return }

    const [{ data: reviewsRaw }, { data: photos }, { data: { session } }] = await Promise.all([
      supabase
        .from('reviews_with_profiles')
        .select('*')
        .eq('wing_spot_id', spot.id)
        .order('visited_at', { ascending: false }),
      supabase
        .from('review_photos')
        .select('*')
        .in('review_id',
          (await supabase.from('reviews').select('id').eq('wing_spot_id', spot.id)).data?.map(r => r.id) ?? []
        )
        .order('display_order'),
      supabase.auth.getSession(),
    ])

    const photosByReview = new Map<string, ReviewPhoto[]>()
    for (const p of (photos ?? []) as ReviewPhoto[]) {
      const list = photosByReview.get(p.review_id) ?? []
      list.push(p)
      photosByReview.set(p.review_id, list)
    }

    const reviews: Review[] = ((reviewsRaw ?? []) as Review[]).map(r => ({
      ...r,
      photos: photosByReview.get(r.id) ?? [],
    }))

    const ratings = reviews.map(r => Number(r.overall_rating)).filter(n => !Number.isNaN(n))
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null

    setCurrentUserId(session?.user?.id ?? '')
    setData({ spot: spot as WingSpot, reviews, avgRating: avg })
    setStatus('ready')
  }, [slug])

  useEffect(() => {
    setStatus('loading')
    load()
  }, [load])

  const handleUpdate = useCallback(async (id: string, data: ReviewUpdateData) => {
    const result = await updateReviewAction(id, data)
    if (!result.error) await load()
    return result
  }, [load])

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteReviewAction(id)
    if (!result.error) await load()
    return result
  }, [load])

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
        <h1 className="font-display uppercase text-3xl text-night-900">No spot here</h1>
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

  const { spot, reviews, avgRating } = data
  const coverPhoto = reviews.flatMap(r => r.photos ?? [])[0]?.url
  const description = avgRating
    ? `${avgRating.toFixed(1)}/10 from ${reviews.length} wing ${reviews.length === 1 ? 'review' : 'reviews'} on WingKingTony.`
    : `Wing reviews from WingKingTony — ${spot.address}.`

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>{spot.name} — WingKingTony</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={`${spot.name} — WingKingTony`} />
        <meta property="og:description" content={description} />
        {coverPhoto && <meta property="og:image" content={coverPhoto} />}
        <meta property="og:type" content="place" />
        <link rel="canonical" href={`https://wingkingtony.com/spots/${spot.slug}`} />
      </Helmet>

      <AppHeader />

      <header className="border-b-2 border-night-900 bg-cream-100">
        <div className="max-w-3xl mx-auto px-5 py-6">
          <h1 className="font-display uppercase text-4xl md:text-5xl text-night-900 leading-none tracking-tightest">
            {spot.name}
          </h1>
          <p className="text-sm text-charcoal-600 mt-2">{spot.address}</p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {avgRating != null && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sauce-400 border-2 border-night-900 rounded-lg shadow-sticker">
                <span className="font-display text-xl text-night-900">{avgRating.toFixed(1)}</span>
                <span className="text-xs uppercase font-bold tracking-crowd text-night-900">/ 10</span>
                <span className="text-xs text-night-900 ml-2">· {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
              </div>
            )}
            <button
              onClick={handleLogWing}
              className="btn-primary px-4 py-1.5 text-xs"
            >
              Log a wing here
            </button>
            <ShareButton
              title={`${spot.name} — WingKingTony`}
              text={`Check out the wings at ${spot.name}`}
              url={window.location.href}
            />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 pb-safe-8 space-y-6">
        {spot.lat != null && spot.lng != null && (
          <SpotMap lat={spot.lat} lng={spot.lng} name={spot.name} />
        )}

        {reviews.length === 0 ? (
          <div className="relative flex flex-col items-center justify-center py-12 px-6 text-center bg-cream-50 border-2 border-night-900 rounded-xl shadow-sticker overflow-hidden">
            <div className="absolute inset-0 bg-splatter opacity-10 pointer-events-none" aria-hidden="true" />
            <div className="relative">
              <div className="text-4xl mb-3">🍗</div>
              <p className="eyebrow mb-2">Empty plate</p>
              <h3 className="font-display uppercase tracking-wide text-2xl text-night-900 leading-tight mb-2">
                No reviews here yet
              </h3>
              <p className="text-sm text-charcoal-600 max-w-xs mx-auto leading-relaxed mb-4">
                Be the first to log a wing at <span className="font-bold text-night-800">{spot.name}</span>.
              </p>
              <button
                onClick={handleLogWing}
                className="btn-primary"
              >
                Log a wing here
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-cream-50 border-2 border-night-900 rounded-xl shadow-sticker divide-y-2 divide-night-900/10">
            {reviews.map(r => (
              <div key={r.id} className="px-5">
                <ReviewCard
                  review={r}
                  currentUserId={currentUserId}
                  isAdmin={auth?.isAdmin ?? false}
                  onUpdate={handleUpdate}
                  onDelete={async (id) => {
                    const res = await handleDelete(id)
                    if (res.error) toast.error(res.error)
                    return res
                  }}
                />
                {r.photos && r.photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-4">
                    {r.photos.map((p, i) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setLightbox({ photos: r.photos!, index: i })}
                        className="aspect-square overflow-hidden rounded-lg border-2 border-night-900 hover:border-sauce-400 transition-colors"
                      >
                        <img
                          src={p.url}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
                <div className="pb-3">
                  <Link to={`/reviews/${r.id}`} className="text-xs text-sauce-500 hover:underline">
                    Permalink →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos.map(p => ({ id: p.id, url: p.url }))}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {showLogModal && (
        <ReviewFormModal
          onClose={() => setShowLogModal(false)}
          prefill={{
            shop_name: spot.name,
            address: spot.address,
            lat: spot.lat,
            lng: spot.lng,
          }}
          onSubmit={async (formData: ReviewFormData) => {
            if (!currentUserId) return { error: 'You must be signed in' }
            const result = await createReviewAction(formData, currentUserId)
            if (!result.error) {
              setShowLogModal(false)
              await load()
            }
            return result
          }}
        />
      )}
    </div>
  )
}
