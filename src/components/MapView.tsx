import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import Supercluster from 'supercluster'
import StarRating from './ui/StarRating'
import ReviewCard from './ReviewCard'
import PhotoModal from './gallery/PhotoModal'
import { Lightbox } from './ui/PhotoGallery'
import { usePhotoDetail } from '../hooks/usePhotoDetail'
import type { SpotWithReviews, Review, ReviewPhoto, ReviewUpdateData } from '../lib/types'

interface Props {
  shops: SpotWithReviews[]
  loading: boolean
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  focusShopId?: string | null
  onFocusHandled?: () => void
}

export default function MapView({ shops, loading, currentUserId, isAdmin, onUpdate, onDelete, focusShopId, onFocusHandled }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<LeafletMap | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderRef = useRef<(() => void) | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [selectedSpot, setSelectedShop] = useState<SpotWithReviews | null>(null)

  const photoDetail = usePhotoDetail(currentUserId)

  const shopsWithReviews = shops.filter(s => s.reviews.length > 0)

  // Keep a ref that always mirrors the latest shopsWithReviews so the map init
  // effect can read it without needing it in its dependency array.
  const shopsRef = useRef(shopsWithReviews)
  useEffect(() => { shopsRef.current = shopsWithReviews })

  // ── Map initialisation ───────────────────────────────────────────────────
  // Runs once on mount. Signals readiness via setMapReady(true) so the
  // markers effect can safely depend on that flag instead of the ref.
  useEffect(() => {
    if (!mapRef.current) return

    import('leaflet').then(L => {
      if (leafletRef.current) return // already initialised (StrictMode double-mount)

      // Derive a sensible initial centre from shops that are already loaded,
      // or fall back to a neutral world view so we never hard-code Melbourne.
      const current = shopsRef.current
      let initialCenter: [number, number]
      let initialZoom: number

      if (current.length > 0) {
        const lats = current.map(s => s.spot.lat)
        const lngs = current.map(s => s.spot.lng)
        initialCenter = [
          lats.reduce((a, b) => a + b) / lats.length,
          lngs.reduce((a, b) => a + b) / lngs.length,
        ]
        initialZoom = 13
      } else {
        // No shops yet — show the world; fitBounds will reposition once data arrives
        initialCenter = [20, 0]
        initialZoom = 2
      }

      const map = L.map(mapRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      leafletRef.current = map
      // Signal readiness — this triggers the markers effect via the dep array
      setMapReady(true)
    })

    return () => {
      renderRef.current = null
      markersRef.current = []
      if (leafletRef.current) {
        leafletRef.current.remove()
        leafletRef.current = null
      }
    }
  }, [])

  // ── Markers + Clustering ─────────────────────────────────────────────────
  // Depends on `mapReady` so it re-runs the moment Leaflet is initialised,
  // even if shops were already loaded before the map mounted (the race that
  // caused markers to silently disappear).
  // Uses supercluster (pure ESM) for viewport-aware zoom-based clustering.
  useEffect(() => {
    if (!leafletRef.current) return

    import('leaflet').then(L => {
      const map = leafletRef.current!

      // Detach any previous moveend/zoomend handler before replacing it
      if (renderRef.current) {
        map.off('moveend', renderRef.current)
        map.off('zoomend', renderRef.current)
        renderRef.current = null
      }

      // Clear stale markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      if (shopsWithReviews.length === 0) return

      // Build the spatial index for this set of shops
      const sc = new Supercluster<{ id: string }>({ radius: 60, maxZoom: 16 })
      sc.load(
        shopsWithReviews.map(s => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [s.spot.lng, s.spot.lat] },
          properties: { id: s.spot.id },
        }))
      )

      // render() recomputes clusters for the current viewport and replaces markers.
      // Called once immediately, then on every moveend/zoomend.
      function render() {
        markersRef.current.forEach(m => m.remove())
        markersRef.current = []

        const b = map.getBounds()
        const zoom = Math.floor(map.getZoom())
        const bbox: [number, number, number, number] = [
          b.getWest(), b.getSouth(), b.getEast(), b.getNorth(),
        ]

        sc.getClusters(bbox, zoom).forEach(feature => {
          const [lng, lat] = feature.geometry.coordinates
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const props = feature.properties as any

          if (props.cluster) {
            // Cluster badge — click zooms to the expansion zoom for that cluster
            const icon = createClusterIcon(L, props.point_count as number)
            const marker = L.marker([lat, lng], { icon })
              .on('click', () => {
                const z = Math.min(sc.getClusterExpansionZoom(props.cluster_id as number), 18)
                map.flyTo([lat, lng], z, { duration: 0.35 })
              })
            marker.addTo(map)
            markersRef.current.push(marker)
          } else {
            // Individual wing pin
            const spotData = shopsWithReviews.find(s => s.spot.id === props.id)
            if (!spotData) return
            const icon = createPinIcon(L, spotData.avg_rating, spotData.photos[0]?.url ?? null)
            const marker = L.marker([lat, lng], { icon })
              .on('click', () => setSelectedShop(spotData))
            marker.addTo(map)
            markersRef.current.push(marker)
          }
        })
      }

      renderRef.current = render
      map.on('moveend', render)
      map.on('zoomend', render)

      // Initial render then fit all shops into view
      render()
      if (shopsWithReviews.length === 1) {
        // Single point — setView avoids degenerate zero-area bounds from fitBounds
        const s = shopsWithReviews[0]
        map.setView([s.spot.lat, s.spot.lng], 15)
      } else {
        const allBounds = shopsWithReviews.map(s => [s.spot.lat, s.spot.lng]) as [number, number][]
        map.fitBounds(allBounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 15 })
      }
    })

    return () => {
      if (renderRef.current && leafletRef.current) {
        leafletRef.current.off('moveend', renderRef.current)
        leafletRef.current.off('zoomend', renderRef.current)
        renderRef.current = null
      }
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, shopsWithReviews.map(s => s.spot.id).join(',')])

  // ── Focus on a specific shop (triggered from list/gallery "View on Map") ──
  useEffect(() => {
    if (!focusShopId || !mapReady || !leafletRef.current) return
    const spotData = shopsWithReviews.find(s => s.spot.id === focusShopId)
    if (!spotData) return

    leafletRef.current.setView([spotData.spot.lat, spotData.spot.lng], 16, { animate: true, duration: 0.5 })
    // Small delay so the map finishes panning and markers re-render at the new viewport
    setTimeout(() => setSelectedShop(spotData), 350)
    onFocusHandled?.()
  }, [focusShopId, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // The header height varies with safe-area + optional event broadcast strip,
    // so we leave a 96px envelope below 100dvh to keep the map fully visible
    // without forcing the user to scroll past it.
    <div
      className="relative w-full"
      style={{ height: 'calc(100dvh - 96px - env(safe-area-inset-top))' }}
    >
      <div ref={mapRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 bg-cream-50/60 flex items-center justify-center z-10">
          <div className="w-10 h-10 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
        </div>
      )}

      {!loading && shopsWithReviews.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none px-4 w-full max-w-xs">
          <div className="bg-cream-50/95 backdrop-blur-sm rounded-2xl px-6 py-5 shadow-card border-2 border-night-900 text-center">
            <div className="text-3xl mb-2">📍</div>
            <p className="font-display uppercase tracking-wide text-lg text-night-900">No spots yet</p>
            <p className="text-xs text-charcoal-500 mt-1">Add a review to see it here</p>
          </div>
        </div>
      )}

      {selectedSpot && (
        <ShopPanel
          spotData={selectedSpot}
          onClose={() => setSelectedShop(null)}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onPhotoOpen={photoDetail.open}
        />
      )}

      {/* Photo detail loading overlay */}
      {photoDetail.loading && (
        <div className="fixed inset-0 z-[140] bg-black/40 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
        </div>
      )}

      {/* Photo detail modal */}
      {photoDetail.photo && (
        <PhotoModal
          photo={photoDetail.photo}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={photoDetail.close}
          onLike={photoDetail.toggleLike}
          onCommentAdded={photoDetail.onCommentAdded}
        />
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createPinIcon(L: any, avgRating: number, photoUrl: string | null) {
  const score = avgRating.toFixed(1)
  // Only embed URLs that originate from our own storage (guard against injection)
  const safePhoto = photoUrl && photoUrl.startsWith('https://') ? photoUrl : null
  const thumbHtml = safePhoto ? `
    <div style="
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid #fdfaf2;
      box-shadow: 0 2px 8px rgba(4,5,14,0.20);
      margin-bottom: 3px;
      flex-shrink: 0;
    ">
      <img src="${safePhoto}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
    </div>
  ` : ''

  const totalHeight = safePhoto ? 96 : 52

  return L.divIcon({
    className: '',
    iconSize: [44, totalHeight],
    iconAnchor: [22, totalHeight],
    html: `
      <div style="
        width:44px;
        height:${totalHeight}px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:flex-end;
        filter: drop-shadow(0 4px 8px rgba(4,5,14,0.32));
      ">
        ${thumbHtml}
        <div style="
          background: #fdfaf2;
          border: 2px solid #04050e;
          border-radius: 10px;
          padding: 4px 6px;
          font-size: 11px;
          font-weight: 800;
          color: #04050e;
          white-space: nowrap;
          line-height: 1;
          font-family: Inter, system-ui, sans-serif;
        ">🍗 ${score}</div>
        <div style="
          width: 10px;
          height: 10px;
          background: #04050e;
          clip-path: polygon(0 0, 100% 0, 50% 100%);
          margin-top: -1px;
        "></div>
      </div>
    `,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(L: any, count: number) {
  // Scale the badge size slightly with count so large clusters feel distinct
  const size = count < 10 ? 42 : count < 50 ? 48 : 56
  const fontSize = count < 10 ? 13 : count < 100 ? 12 : 11

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: #fa5a2e;
        border: 2.5px solid #04050e;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 4px 10px rgba(4,5,14,0.32));
      ">
        <span style="
          font-family: Inter, system-ui, sans-serif;
          font-weight: 800;
          font-size: ${fontSize}px;
          color: #fdfaf2;
          line-height: 1;
          white-space: nowrap;
        ">🍗 ${count}</span>
      </div>
    `,
  })
}

interface ShopPanelProps {
  spotData: SpotWithReviews
  onClose: () => void
  currentUserId: string
  isAdmin: boolean
  onUpdate: Props['onUpdate']
  onDelete: Props['onDelete']
  onPhotoOpen: (photoId: string) => void
}

function ShopPanel({ spotData, onClose, currentUserId, isAdmin, onUpdate, onDelete, onPhotoOpen }: ShopPanelProps) {
  const { spot, reviews, avg_rating, photos } = spotData

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="absolute inset-0 z-20 sm:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-30 sm:left-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-80 bg-cream-50 rounded-t-3xl sm:rounded-3xl sm:border-2 sm:border-night-900 shadow-elevated animate-slide-up max-h-[72dvh] sm:max-h-[calc(100dvh-120px)] flex flex-col">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-night-900/25" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-night-900/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display uppercase tracking-wide text-base text-night-900 leading-snug truncate">
              {spot.name}
            </h3>
            <p className="text-xs text-charcoal-500 mt-0.5 truncate">{spot.address}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {reviews.length > 1 && (
                <span className="text-xs text-charcoal-400">avg of {reviews.length}</span>
              )}
              <span className="rating-wing">
                🍗 <StarRating value={avg_rating} size="sm" />
                <span className="ml-0.5">{avg_rating.toFixed(1)}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-charcoal-500 hover:bg-cream-100 hover:text-night-900 transition-colors text-2xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="overflow-y-auto flex-1 overscroll-contain"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Photo strip */}
          {photos.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <PhotoStrip photos={photos} onPhotoOpen={onPhotoOpen} />
            </div>
          )}

          {/* Reviews */}
          <div className="px-5 pb-5 divide-y divide-night-900/10">
            {reviews.map((review: Review) => (
              <ReviewCard
                key={review.id}
                review={review}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onUpdate={onUpdate}
                onDelete={onDelete}
                compact
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

interface PhotoStripProps {
  photos: ReviewPhoto[]
  onPhotoOpen: (photoId: string) => void
}

function PhotoStrip({ photos, onPhotoOpen }: PhotoStripProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => onPhotoOpen(photo.id)}
              className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-cream-200 border-2 border-night-900 hover:border-sauce-400 transition-colors focus:outline-none focus:ring-2 focus:ring-sauce-300"
            >
              <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
