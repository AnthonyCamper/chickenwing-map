import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useReviews } from '../hooks/useReviews'
import { usePhotoDetail } from '../hooks/usePhotoDetail'
import { useHistoryModal } from '../hooks/useHistoryModal'
import Layout from '../components/Layout'
import LiveScene from '../components/LiveScene'
import ListView from '../components/ListView'
import MapView from '../components/MapView'
import GalleryView from '../components/gallery/GalleryView'
import PhotoModal from '../components/gallery/PhotoModal'
import ReviewFormModal from '../components/ReviewFormModal'
import { AuthGateProvider } from '../components/AuthGateModal'
import { UserProfileProvider } from '../components/UserProfileContext'
import type { AuthState } from '../hooks/useAuth'

type View = 'list' | 'map' | 'gallery'
type SortKey = 'name' | 'rating'

type HomeProps = { auth: AuthState; readOnly?: boolean }

export default function Home({ auth, readOnly = false }: HomeProps) {
  const reviews = useReviews()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showAddModal, setShowAddModal] = useState(false)
  const [focusShopId, setFocusShopId] = useState<string | null>(null)
  const deepLinkHandled = useRef(false)

  // ── View state from URL ──────────────────────────────────────────────
  const view = (searchParams.get('view') as View) || 'list'

  const setView = useCallback((newView: View) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (newView === 'list') next.delete('view')
      else next.set('view', newView)
      return next
    })
  }, [setSearchParams])

  // ── Lifted list-view state (persists across view switches) ───────────
  const [listSort, setListSort] = useState<SortKey>('name')
  const [listFilter, setListFilter] = useState<string>('all')
  const [listExpandedShop, setListExpandedShop] = useState<string | null>(null)

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

  // ── Deep link photo detail ───────────────────────────────────────────
  const deepLinkPhoto = usePhotoDetail(auth.user?.id ?? '')

  // Handle deep link URL params on mount
  useEffect(() => {
    if (deepLinkHandled.current) return
    const params = new URLSearchParams(window.location.search)
    const photoId = params.get('photo')
    const reviewId = params.get('review')

    if (photoId) {
      deepLinkHandled.current = true
      deepLinkPhoto.open(photoId)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (reviewId) {
      deepLinkHandled.current = true
      setView('list')
      requestAnimationFrame(() => {
        const el = document.getElementById(`review-${reviewId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-4', 'ring-sauce-400', 'ring-offset-2', 'ring-offset-cream-50')
          setTimeout(() => el.classList.remove('ring-4', 'ring-sauce-400', 'ring-offset-2', 'ring-offset-cream-50'), 3000)
        }
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle in-app deep link events (from service worker via useNotifications)
  useEffect(() => {
    const handler = (e: Event) => {
      const { photoId, reviewId } = (e as CustomEvent).detail
      if (photoId) {
        deepLinkPhoto.open(photoId)
      } else if (reviewId) {
        setView('list')
        requestAnimationFrame(() => {
          const el = document.getElementById(`review-${reviewId}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.classList.add('ring-2', 'ring-amber-300', 'ring-offset-2')
            setTimeout(() => el.classList.remove('ring-2', 'ring-amber-300', 'ring-offset-2'), 3000)
          }
        })
      }
    }
    window.addEventListener('push-deep-link', handler)
    return () => window.removeEventListener('push-deep-link', handler)
  }, [deepLinkPhoto.open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── History-backed modals (browser back closes them) ─────────────────
  useHistoryModal(showAddModal, () => setShowAddModal(false))
  useHistoryModal(!!deepLinkPhoto.photo, deepLinkPhoto.close)

  const handleViewOnMap = (shopId: string) => {
    setFocusShopId(shopId)
    setView('map')
  }

  const isAuthenticated = !!auth.user

  return (
    <UserProfileProvider currentUserId={auth.user?.id ?? ''}>
    <AuthGateProvider isAuthenticated={isAuthenticated} onSignInGoogle={auth.signInWithGoogle}>
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
          onUpdate={reviews.updateReview}
          onDelete={reviews.deleteReview}
          onViewOnMap={handleViewOnMap}
          sortBy={listSort}
          onSortChange={setListSort}
          filterReviewer={listFilter}
          onFilterChange={setListFilter}
          expandedShop={listExpandedShop}
          onExpandShop={setListExpandedShop}
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

      {/* Deep link photo modal — opened from notification clicks / URL params */}
      {deepLinkPhoto.loading && (
        <div className="fixed inset-0 z-50 bg-night-900/70 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-night-700 border-t-sauce-400 animate-spin" />
        </div>
      )}
      {deepLinkPhoto.photo && (
        <PhotoModal
          photo={deepLinkPhoto.photo}
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
          onClose={deepLinkPhoto.close}
          onLike={deepLinkPhoto.toggleLike}
          onCommentAdded={deepLinkPhoto.onCommentAdded}
          onViewOnMap={(shopId) => { deepLinkPhoto.close(); handleViewOnMap(shopId) }}
        />
      )}
    </Layout>
    </AuthGateProvider>
    </UserProfileProvider>
  )
}
