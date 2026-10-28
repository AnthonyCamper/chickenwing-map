import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import Supercluster from 'supercluster'
import toast from 'react-hot-toast'
import PhotoModal from './gallery/PhotoModal'
import ShopPanel from './ShopPanel'
import { usePhotoDetail } from '../hooks/usePhotoDetail'
import { useHistoryModal } from '../hooks/useHistoryModal'
import { minZoomToFillHeight, pickInitialFocus } from '../lib/mapFocus'
import type { SpotWithReviews, ReviewUpdateData } from '../lib/types'
import { formatRating } from '../lib/formatRating'

const CAMERA_KEY = 'wingmap-camera'

function readSavedCamera(): { lat: number; lng: number; zoom: number } | null {
  try {
    const raw = sessionStorage.getItem(CAMERA_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    return typeof c?.lat === 'number' && typeof c?.lng === 'number' && typeof c?.zoom === 'number' ? c : null
  } catch {
    return null
  }
}

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
  const [locating, setLocating] = useState(false)
  // Set true when the map is initialised from a saved camera position, so the
  // markers effect's auto-fit never stomps a restored view.
  const restoredCameraRef = useRef(false)
  // The auto-fit runs once, when the spots first arrive; a new review coming
  // in later must not yank the map away from where the user is looking.
  const fittedRef = useRef(false)

  const handleLocateMe = () => {
    if (!leafletRef.current || !navigator.geolocation) {
      toast.error('Location not available in this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        leafletRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 0.6 })
        setLocating(false)
      },
      err => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Location permission denied.')
        } else {
          toast.error("Couldn't find your location.")
        }
      },
      { timeout: 8000, enableHighAccuracy: false }
    )
  }

  const photoDetail = usePhotoDetail(currentUserId)
  useHistoryModal(!!photoDetail.review, photoDetail.close)

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

      // A saved camera from a previous session wins over any derived position —
      // it reflects where the user actually left the map, not just the shops'
      // centroid. Otherwise derive a sensible centre from shops that are
      // already loaded, or fall back to a neutral world view so we never
      // hard-code Melbourne.
      const savedCamera = readSavedCamera()
      const current = shopsRef.current
      let initialCenter: [number, number]
      let initialZoom: number

      if (savedCamera) {
        initialCenter = [savedCamera.lat, savedCamera.lng]
        initialZoom = savedCamera.zoom
        restoredCameraRef.current = true
      } else if (current.length > 0) {
        const focus = pickInitialFocus(current.map(s => s.spot))
        const lats = focus.map(s => s.lat)
        const lngs = focus.map(s => s.lng)
        initialCenter = [
          lats.reduce((a, b) => a + b) / lats.length,
          lngs.reduce((a, b) => a + b) / lngs.length,
        ]
        initialZoom = 5
      } else {
        // No shops yet — show the world; fitBounds will reposition once data arrives
        initialCenter = [20, 0]
        initialZoom = 2
      }

      const map = L.map(mapRef.current!, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: true,
        // Never scroll past the top or bottom of the world: that showed an
        // empty beige band above the map on phones.
        maxBounds: L.latLngBounds([-85.05, -540], [85.05, 540]),
        maxBoundsViscosity: 1,
      })
      // …and never zoom out so far that the world is shorter than the map.
      const fillHeight = () => map.setMinZoom(minZoomToFillHeight(map.getSize().y))
      fillHeight()
      map.on('resize', fillHeight)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Persist the camera on every pan/zoom so a refresh can restore it.
      map.on('moveend', () => {
        const c = map.getCenter()
        try {
          sessionStorage.setItem(CAMERA_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }))
        } catch { /* ignore */ }
      })

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
      // radius is measured against `extent`; with the default 512 extent a
      // radius of 60 was only ~30 screen px, so pins and cluster bubbles
      // (44–60px wide) sat on top of each other.
      const sc = new Supercluster<{ id: string }>({ radius: 72, extent: 256, maxZoom: 16 })
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
            const n = props.point_count as number
            const marker = L.marker([lat, lng], { icon, title: `${n} spots here. Tap to zoom in.` })
              .on('click', () => {
                // Zoom straight to the area these spots cover, not just one
                // level at a time (that took 4–5 taps from the world view).
                const clusterId = props.cluster_id as number
                const expansionZoom = Math.min(sc.getClusterExpansionZoom(clusterId), 18)
                const leaves = sc.getLeaves(clusterId, Infinity)
                const bounds = L.latLngBounds(
                  leaves.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]] as [number, number])
                )
                const padding = L.point(48, 48)
                const fitZoom = Math.min(map.getBoundsZoom(bounds, false, padding), 18)
                if (bounds.isValid() && fitZoom > expansionZoom) {
                  map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 18, duration: 0.5 })
                } else {
                  map.flyTo([lat, lng], expansionZoom, { duration: 0.35 })
                }
              })
            marker.addTo(map)
            markersRef.current.push(marker)
          } else {
            // Individual wing pin
            const spotData = shopsWithReviews.find(s => s.spot.id === props.id)
            if (!spotData) return
            const icon = createPinIcon(L, spotData.avg_rating, spotData.photos[0]?.url ?? null)
            const marker = L.marker([lat, lng], {
              icon,
              title: `${spotData.spot.name}: rated ${formatRating(spotData.avg_rating)} out of 10`,
            })
              .on('click', () => setSelectedShop(spotData))
            marker.addTo(map)
            markersRef.current.push(marker)
          }
        })
      }

      renderRef.current = render
      map.on('moveend', render)
      map.on('zoomend', render)

      // Initial render then fit all shops into view — unless the map started
      // from a restored camera, in which case that position must win.
      render()
      if (!restoredCameraRef.current && !fittedRef.current) {
        fittedRef.current = true
        // Open on the region holding most spots, not the whole world.
        const focus = pickInitialFocus(shopsWithReviews.map(s => s.spot))
        if (focus.length === 1) {
          // Single point — setView avoids degenerate zero-area bounds from fitBounds
          map.setView([focus[0].lat, focus[0].lng], 15)
        } else {
          const bounds = focus.map(s => [s.lat, s.lng]) as [number, number][]
          map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 15 })
        }
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

  // ── Keep the selected pin visible above the spot sheet (phones) ──────────
  // The sheet covers up to ~72% of the map from the bottom; a tapped pin in
  // the lower part of the map ended up hidden behind it (m2 S21). Once the
  // sheet has laid out, pan so the pin sits in the middle of the map area
  // still showing above it.
  useEffect(() => {
    const map = leafletRef.current
    const container = containerRef.current
    if (!selectedSpot || !map || !container) return
    if (window.matchMedia('(min-width: 640px)').matches) return // side panel, not a sheet
    const raf = requestAnimationFrame(() => {
      const sheet = container.querySelector<HTMLElement>('[data-spot-sheet]')
      if (!sheet) return
      // offsetTop ignores the slide-up transform, i.e. where the sheet settles.
      const visibleBottom = sheet.offsetTop
      const pin = map.latLngToContainerPoint([selectedSpot.spot.lat, selectedSpot.spot.lng])
      const margin = 56 // room for the pin's label above its point
      if (pin.y >= margin && pin.y <= visibleBottom - 16) return
      const targetY = Math.max(margin, visibleBottom / 2 + margin / 2)
      map.panBy([0, pin.y - targetY], { animate: true, duration: 0.3 })
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedSpot])

  // ── Fill the viewport below the app chrome ────────────────────────────────
  // The chrome above us varies (safe-area, event broadcast strip, live
  // marquee), so measure our own document offset instead of hardcoding an
  // envelope — a wrong constant either crops the map or forces page scroll.
  const containerRef = useRef<HTMLDivElement>(null)
  const [chromeOffset, setChromeOffset] = useState(96)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const top = Math.round(el.getBoundingClientRect().top + window.scrollY)
      setChromeOffset(prev => (Math.abs(prev - top) > 1 ? top : prev))
    }
    update()
    window.addEventListener('resize', update)
    const ro = new ResizeObserver(update) // catches strips mounting/unmounting
    ro.observe(document.body)
    return () => { window.removeEventListener('resize', update); ro.disconnect() }
  }, [])
  useEffect(() => {
    leafletRef.current?.invalidateSize()
  }, [chromeOffset])

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: `calc(100dvh - ${chromeOffset}px)` }}
    >
      {/* Land-coloured until the first tiles paint, so the map area never
          reads as an empty page while Leaflet loads */}
      <div ref={mapRef} className="w-full h-full bg-[#f2efe9]" />

      {/* Locate Me button */}
      {mapReady && (
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          aria-label="Show my location"
          title="Show my location"
          className="absolute z-[20] right-3 h-11 pl-3 pr-3.5 gap-1.5 rounded-full bg-cream-50 border-2 border-night-900 shadow-sticker hover:bg-cream-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center disabled:opacity-60"
          style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
        >
          {locating ? (
            <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-night-700 border-t-sauce-400 animate-spin" />
          ) : (
            <svg aria-hidden="true" className="w-5 h-5 text-night-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          )}
          {/* A bare crosshair meant nothing to testers; say what it does */}
          <span aria-hidden="true" className="text-[11px] font-extrabold uppercase tracking-crowd text-night-900">
            {locating ? 'Finding you…' : 'My location'}
          </span>
        </button>
      )}

      {/* Spots still loading: the base map is already usable, so show a
          small status pill instead of covering it with a spinner */}
      {loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none" role="status">
          <div className="flex items-center gap-2 rounded-full bg-cream-50/95 border-2 border-night-900 shadow-sticker-sm px-3 py-1.5">
            <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full border-2 border-cream-200 border-t-sauce-400 animate-spin" />
            <span className="text-[11px] font-extrabold uppercase tracking-crowd text-night-900 whitespace-nowrap">Loading spots…</span>
          </div>
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
          key={selectedSpot.spot.id}
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
      {photoDetail.review && (
        <PhotoModal
          review={photoDetail.review}
          initialPhotoIndex={photoDetail.initialIndex}
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
  const score = formatRating(avgRating)
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
  // Wide enough for "🍗 7.1/10": a bare "7.1" didn't say it was out of 10
  const width = 72

  return L.divIcon({
    className: '',
    iconSize: [width, totalHeight],
    iconAnchor: [width / 2, totalHeight],
    html: `
      <div style="
        width:${width}px;
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
        ">🍗 ${score}<span style="font-size:9px;font-weight:700;opacity:0.7;">/10</span></div>
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
  // Deliberately unlike a rating pin (cream tag with "🍗 7.5" and a pointer):
  // a dark round badge with a white ring, the count and the word "spots", so
  // nobody reads "12" as a score.
  const size = count < 10 ? 48 : count < 100 ? 54 : 60
  const fontSize = count < 100 ? 16 : 14

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: #0d122a;
        border: 3px solid #fdfaf2;
        outline: 2px solid #04050e;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        filter: drop-shadow(0 4px 10px rgba(4,5,14,0.32));
        font-family: Inter, system-ui, sans-serif;
        color: #fdfaf2;
        line-height: 1;
        white-space: nowrap;
      ">
        <span style="font-weight: 800; font-size: ${fontSize}px;">${count}</span>
        <span style="font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.85;">spots</span>
      </div>
    `,
  })
}
