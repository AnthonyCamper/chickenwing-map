import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useReviews } from '../hooks/useReviews'
import { useTickerSpots } from '../hooks/useTickerSpots'
import { useHistoryModal } from '../hooks/useHistoryModal'
import { lazyWithReload } from '../lib/staleDeploy'
import { supabase } from '../lib/supabase'
import { isFastConnection, useFeedLandingSettled, whenIdle } from '../lib/feedLanding'
import { prefetchWhenIdle } from '../lib/idlePrefetch'
import Layout from '../components/Layout'
import LiveScene from '../components/LiveScene'
import GalleryView from '../components/gallery/GalleryView'
import ReviewFormModal, { prefetchReviewFormModal } from '../components/LazyReviewFormModal'
import { UserProfileProvider } from '../components/UserProfileContext'
import { ListViewSkeleton, MapViewSkeleton } from '../components/SpotsViewSkeletons'
import type { AuthState } from '../hooks/useAuth'

// The landing view is the feed; Spots and Map (Leaflet + supercluster) load
// on first switch so slow phones don't download them before the feed shows.
// lazyWithReload: a chunk from an older deploy reloads the page cleanly
// instead of showing the error screen.
const ListView = lazyWithReload(() => import('../components/ListView'))
const MapView = lazyWithReload(() => import('../components/MapView'))

/** One-line "what is this" for signed-out visitors. Kept short so the feed
 *  still starts above the fold on a phone. */
function WelcomeIntro() {
  return (
    <section
      aria-label="About WingKingTony"
      className="max-w-2xl mx-auto px-4 pt-4"
    >
      <div className="card px-4 pt-3 pb-1">
        <div className="sm:flex sm:items-center sm:justify-between sm:gap-4">
          {/* Two lines reserved on phones: before the web font loads this
              wraps, after it doesn't — without the reserve the whole feed
              jumped up 20px (measured CLS 0.31 on Slow 3G). */}
          <p className="text-sm font-bold text-night-900 leading-snug min-h-[2.75em] sm:min-h-0">
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
        {/* Visitors check these before signing up; the page footer is
            thousands of pixels down the feed. Fixed height: no layout jump. */}
        <p className="flex items-center justify-end gap-1 h-8 text-xs text-charcoal-500">
          <Link to="/privacy" className="inline-flex items-center min-h-[44px] -my-1.5 px-1.5 font-bold hover:text-sauce-600 underline-offset-2 hover:underline">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" className="inline-flex items-center min-h-[44px] -my-1.5 px-1.5 font-bold hover:text-sauce-600 underline-offset-2 hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </section>
  )
}

type View = 'list' | 'map' | 'gallery'
type SortKey = 'name' | 'rating'

type HomeProps = { auth: AuthState; readOnly?: boolean }

export default function Home({ auth, readOnly = false }: HomeProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAddModal, setShowAddModal] = useState(false)
  const [focusShopId, setFocusShopId] = useState<string | null>(null)
  const deepLinkHandled = useRef(false)

  // ── View state from URL ──────────────────────────────────────────────
  const view = (searchParams.get('view') as View) || 'gallery'

  // ── Data: the feed loads its own; Spots/Map data waits (S26) ─────────
  // The all-spots data (~350 KB) is only used by Spots and Map, and on slow
  // 3G it pushed the feed's first photo back by tens of seconds. It loads
  // when Spots or Map is opened; on a fast connection also once the feed's
  // first photo is in and the page is idle, so those tabs open instantly.
  // On a slow one the ticker gets a small query of its own instead.
  const [spotsWanted, setSpotsWanted] = useState(view !== 'gallery')
  useEffect(() => { if (view !== 'gallery') setSpotsWanted(true) }, [view])
  const landingSettled = useFeedLandingSettled()
  const [afterLanding, setAfterLanding] = useState(false)
  useEffect(() => {
    if (landingSettled) return whenIdle(() => setAfterLanding(true))
  }, [landingSettled])
  const [fastConnection] = useState(isFastConnection)
  const reviews = useReviews({ enabled: spotsWanted || (afterLanding && fastConnection) })
  const ticker = useTickerSpots(afterLanding && !fastConnection && !spotsWanted)

  // The review form's code is fetched on idle for people who can post.
  const canPost = auth.canLeaveReviews && !readOnly
  useEffect(() => { if (canPost) prefetchWhenIdle([prefetchReviewFormModal]) }, [canPost])

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
      liveScene={
        // Whichever arrives first: the full data (Spots/Map) or the ticker's own
        <LiveScene
          spots={reviews.loading ? ticker.spots : reviews.spots}
          loading={reviews.loading && ticker.loading}
        />
      }
    >
      {!auth.user && view !== 'map' && <WelcomeIntro />}

      {/* Page-shaped placeholders (not a spinner) while Spots / Map code loads */}
      <Suspense fallback={view === 'map' ? <MapViewSkeleton /> : <ListViewSkeleton />}>
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
