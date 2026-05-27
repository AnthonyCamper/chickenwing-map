import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useReviews } from '../hooks/useReviews'
import { useHistoryModal } from '../hooks/useHistoryModal'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import LiveScene from '../components/LiveScene'
import ListView from '../components/ListView'
import MapView from '../components/MapView'
import GalleryView from '../components/gallery/GalleryView'
import ReviewFormModal from '../components/ReviewFormModal'
import { UserProfileProvider } from '../components/UserProfileContext'
import type { AuthState } from '../hooks/useAuth'

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

  // ── Lifted list-view state (persists across view switches) ───────────
  const [listSort, setListSort] = useState<SortKey>('name')
  const [listFilter, setListFilter] = useState<string>('all')

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
      navigate(`/reviews/${reviewId}`, { replace: true })
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

  return (
    <UserProfileProvider currentUserId={auth.user?.id ?? ''}>
    <Layout
      auth={auth}
      view={view}
      onViewChange={setView}
      onAddReview={() => {
          if (!auth.canLeaveReviews) {
            toast.error("the admin hasn't enabled reviews for your account yet.")
            return
          }
          setShowAddModal(true)
        }}
      readOnly={readOnly}
      liveScene={<LiveScene spots={reviews.spots} loading={reviews.loading} />}
    >
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
      {view === 'gallery' && (
        <GalleryView
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onViewOnMap={handleViewOnMap}
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
