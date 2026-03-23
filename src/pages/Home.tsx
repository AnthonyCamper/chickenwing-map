import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useReviews } from '../hooks/useReviews'
import { usePhotoDetail } from '../hooks/usePhotoDetail'
import Layout from '../components/Layout'
import ListView from '../components/ListView'
import MapView from '../components/MapView'
import GalleryView from '../components/gallery/GalleryView'
import PhotoModal from '../components/gallery/PhotoModal'
import ReviewFormModal from '../components/ReviewFormModal'
import type { AuthState } from '../hooks/useAuth'

type HomeProps = { auth: AuthState; readOnly?: boolean }

export default function Home({ auth, readOnly = false }: HomeProps) {
  const reviews = useReviews()
  const [view, setView] = useState<'list' | 'map' | 'gallery'>('list')
  const [showAddModal, setShowAddModal] = useState(false)
  const deepLinkHandled = useRef(false)

  // Deep link photo detail (opened from notification clicks / URL params)
  const deepLinkPhoto = usePhotoDetail(auth.user?.id ?? '')

  // ── Handle deep link URL params on mount ──────────────────────────────
  useEffect(() => {
    if (deepLinkHandled.current) return
    const params = new URLSearchParams(window.location.search)
    const photoId = params.get('photo')
    const reviewId = params.get('review')
    // commentId is available for future comment-level highlighting
    // const commentId = params.get('comment')

    if (photoId) {
      deepLinkHandled.current = true
      deepLinkPhoto.open(photoId)
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    } else if (reviewId) {
      deepLinkHandled.current = true
      setView('list')
      // Scroll to review after a brief delay for rendering
      requestAnimationFrame(() => {
        const el = document.getElementById(`review-${reviewId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('ring-2', 'ring-amber-300', 'ring-offset-2')
          setTimeout(() => el.classList.remove('ring-2', 'ring-amber-300', 'ring-offset-2'), 3000)
        }
      })
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle in-app deep link events (from service worker via useNotifications) ─
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

  return (
    <Layout
      auth={auth}
      view={view}
      onViewChange={setView}
      onAddReview={() => {
          if (!auth.canLeaveReviews) {
            toast.error("Reviews haven't been enabled for your account yet.")
            return
          }
          setShowAddModal(true)
        }}
      readOnly={readOnly}
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
        />
      )}
      {view === 'gallery' && (
        <GalleryView
          currentUserId={auth.user?.id ?? ''}
          isAdmin={auth.isAdmin}
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
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
        />
      )}
    </Layout>
  )
}
