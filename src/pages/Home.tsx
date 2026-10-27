import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useReviews } from '../hooks/useReviews'
import { useHistoryModal } from '../hooks/useHistoryModal'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import LiveScene from '../components/LiveScene'
import GalleryView from '../components/gallery/GalleryView'
import ReviewFormModal from '../components/ReviewFormModal'
import { UserProfileProvider } from '../components/UserProfileContext'
import type { AuthState } from '../hooks/useAuth'

// The landing view is the feed; Spots and Map (Leaflet + supercluster) load
// on first switch so slow phones don't download them before the feed shows.
const ListView = lazy(() => import('../components/ListView'))
const MapView = lazy(() => import('../components/MapView'))

function ViewFallback({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4" role="status">
      <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      <p className="font-display uppercase tracking-crowd text-sm text-night-700">{label}</p>
    </div>
  )
}

/** One-line "what is this" for signed-out visitors. Kept short so the feed
 *  still starts above the fold on a phone. */
function WelcomeIntro() {
  return (
    <section
      aria-label="About WingKingTony"
      className="max-w-2xl mx-auto px-4 pt-4"
    >
      <div className="card px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm font-bold text-night-900 leading-snug">
          Find and rate chicken wing spots. Free.
        </p>
        <div className="mt-2.5 sm:mt-0 flex items-center gap-2 flex-shrink-0">
          <Link to="/register" className="btn-primary px-3 py-2 text-xs tracking-wide whitespace-nowrap flex-1 sm:flex-none">
            Create free account
          </Link>
          <Link to="/login" className="btn-secondary px-3 py-2 text-xs tracking-wide whitespace-nowrap">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  )
}

type View = 'list' | 'map' | 'gallery'
type SortKey = 'name' | 'rating'

type HomeProps = { auth: AuthState; readOnly?: boolean }

export default function Home({ auth, readOnly = false }: HomeProps) {
  const reviews = useReviews()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAddModal, setShowAddModal] = useState(false)
  const [focusShopId, setFocusShopId] = useState<string | null>(null)
  const deepLinkHandled = useRef(false)

  // ── View state from URL ──────────────────────────────────────────────
  const view = (searchParams.get('view') as View) || 'gallery'

  const setView = useCallback((newView: View) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (newView === 'gallery') next.delete('view')
      else next.set('view', newView)
      return next
    })
  }, [setSearchParams])

  // ── Lifted list-view state (persists across view switches & in URL) ──
  const listSort = (searchParams.get('sort') as SortKey) || 'name'
  const listFilter = searchParams.get('reviewer') || 'all'

  const setListSort = useCallback((next: SortKey) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (next === 'name') p.delete('sort')
      else p.set('sort', next)
      return p
    })
  }, [setSearchParams])

  const setListFilter = useCallback((next: string) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (next === 'all') p.delete('reviewer')
      else p.set('reviewer', next)
      return p
    })
  }, [setSearchParams])

  // ── Scroll position tracking per view ────────────────────────────────
  const scrollPositions = useRef<Record<string, number>>({})

  // Continuously save scroll position for the current view
  useEffect(() => {
    const handler = () => { scrollPositions.current[view] = window.scrollY }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [view])

  // Restore scroll position when view changes
  const prevViewRef = useRef(view)
  useEffect(() => {
    if (prevViewRef.current !== view) {
      const saved = scrollPositions.current[view] ?? 0
      requestAnimationFrame(() => window.scrollTo(0, saved))
      prevViewRef.current = view
    }
  }, [view])

  // Handle legacy deep link URL params on mount — redirect to canonical pages.
  // /?review=<id>  → /reviews/<id>
  // /?photo=<id>   → resolve photo to its review, then /reviews/<reviewId>
  useEffect(() => {
    if (deepLinkHandled.current) return
    const params = new URLSearchParams(window.location.search)
    const photoId = params.get('photo')
    const reviewId = params.get('review')

    if (reviewId) {
      deepLinkHandled.current = true
      ;(async () => {
        const { data } = await supabase
          .from('reviews')
          .select('id')
          .eq('id', reviewId)
          .maybeSingle()
        if (data) {
          navigate(`/reviews/${reviewId}`, { replace: true })
        } else {
          window.history.replaceState({}, '', window.location.pathname)
          toast.error('That review is no longer available.')
        }
      })()
    } else if (photoId) {
      deepLinkHandled.current = true
      ;(async () => {
        const { data } = await supabase
          .from('review_photos')
          .select('review_id')
          .eq('id', photoId)
          .maybeSingle()
        if (data?.review_id) {
          navigate(`/reviews/${data.review_id}`, { replace: true })
        } else {
          window.history.replaceState({}, '', window.location.pathname)
          toast.error('That photo is no longer available.')
        }
      })()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle in-app deep link events (from service worker via useNotifications)
  useEffect(() => {
    const handler = (e: Event) => {
      const { photoId, reviewId, crawlSlug } = (e as CustomEvent).detail
      if (crawlSlug) {
        navigate(`/lists/${crawlSlug}`)
      } else if (reviewId) {
        navigate(`/reviews/${reviewId}`)
      } else if (photoId) {
        ;(async () => {
          const { data } = await supabase
            .from('review_photos')
            .select('review_id')
            .eq('id', photoId)
            .maybeSingle()
          if (data?.review_id) navigate(`/reviews/${data.review_id}`)
        })()
      }
    }
    window.addEventListener('push-deep-link', handler)
    return () => window.removeEventListener('push-deep-link', handler)
  }, [navigate])

  // ── History-backed modals (browser back closes them) ─────────────────
  useHistoryModal(showAddModal, () => setShowAddModal(false))

  const handleViewOnMap = (shopId: string) => {
    setFocusShopId(shopId)
    setView('map')
  }

  const openAddReview = () => {
    if (!auth.canLeaveReviews) {
      toast.error("Your account can't add reviews yet. An admin needs to turn this on.")
      return
    }
    setShowAddModal(true)
  }

  return (
    <UserProfileProvider currentUserId={auth.user?.id ?? ''}>
    <Layout
      auth={auth}
      view={view}
      onViewChange={setView}
      onAddReview={openAddReview}
      readOnly={readOnly}
      liveScene={<LiveScene spots={reviews.spots} loading={reviews.loading} />}
    >
      {!auth.user && view !== 'map' && <WelcomeIntro />}

      <Suspense fallback={<ViewFallback label={view === 'map' ? 'Loading the map…' : 'Loading spots…'} />}>
      {view === 'list' && (
        <ListView
          shops={reviews.spots}
          loading={reviews.loading}
          error={reviews.error}
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onViewOnMap={handleViewOnMap}
          sortBy={listSort}
          onSortChange={setListSort}
          filterReviewer={listFilter}
          onFilterChange={setListFilter}
        />
      )}
      {view === 'map' && (
        <MapView
          shops={reviews.spots}
          loading={reviews.loading}
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onUpdate={reviews.updateReview}
          onDelete={reviews.deleteReview}
          focusShopId={focusShopId}
          onFocusHandled={() => setFocusShopId(null)}
        />
      )}
      </Suspense>
      {view === 'gallery' && (
        <GalleryView
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onViewOnMap={handleViewOnMap}
          onAddReview={readOnly ? undefined : openAddReview}
        />
      )}

      {showAddModal && (
        <ReviewFormModal
          onClose={() => setShowAddModal(false)}
          onSubmit={async (data) => {
            const result = await reviews.createReview(data, auth.user?.id ?? '')
            if (!result.error) setShowAddModal(false)
            return result
          }}
        />
      )}

    </Layout>
    </UserProfileProvider>
  )
}
