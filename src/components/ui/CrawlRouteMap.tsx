import { useEffect, useRef } from 'react'
import type { WingSpot } from '../../lib/types'

interface MapItem {
  spot: WingSpot | null
}

interface Props {
  items: MapItem[]
  className?: string
  /** When provided, tapping a pin invokes this with the spot (used to navigate to the spot page). */
  onSelectSpot?: (spot: WingSpot) => void
}

/**
 * Leaflet map for a crawl: numbered markers per spot in order, with a
 * polyline connecting them — position order always exists, so the route
 * always draws (ranked is a list-presentation choice, not a map one).
 * Updates reactively as items change so it works inside the editor and on
 * the public page.
 */
export default function CrawlRouteMap({ items, className, onSelectSpot }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const layerGroupRef = useRef<import('leaflet').LayerGroup | null>(null)

  // Init map once
  useEffect(() => {
    const el = elRef.current
    if (!el) return

    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || mapRef.current) return
      const map = L.map(el, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
        // One-finger drags would trap vertical page scrolling on mobile;
        // panning stays available via two-finger gestures + zoom buttons.
        dragging: !L.Browser.mobile,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)
      mapRef.current = map
      layerGroupRef.current = L.layerGroup().addTo(map)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        layerGroupRef.current = null
      }
    }
  }, [])

  // Re-render markers + polyline whenever items change
  useEffect(() => {
    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled) return
      const map = mapRef.current
      const group = layerGroupRef.current
      if (!map || !group) return

      group.clearLayers()

      const points = items
        .map((it, idx) => ({ idx, spot: it.spot }))
        .filter(p => p.spot && p.spot.lat != null && p.spot.lng != null) as { idx: number; spot: WingSpot }[]

      if (points.length === 0) {
        // Default view if no points
        map.setView([39.5, -77.0], 6)
        return
      }

      const latlngs = points.map(p => [p.spot.lat, p.spot.lng] as [number, number])

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: '#fa5a2e', weight: 3, opacity: 0.75 }).addTo(group)
      }

      points.forEach((p, i) => {
        const clickable = !!onSelectSpot && !!p.spot.slug
        const icon = L.divIcon({
          html: `<div style="width:30px;height:30px;border-radius:50%;background:#fa5a2e;color:white;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)${clickable ? ';cursor:pointer' : ''}">${i + 1}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          className: '',
        })
        const marker = L.marker([p.spot.lat, p.spot.lng], { icon, title: p.spot.name })
        if (clickable) {
          // Tooltip for discoverability on desktop; click navigates to the spot.
          marker.bindTooltip(`${p.spot.name} — view spot`, { direction: 'top', offset: [0, -16] })
          marker.on('click', () => onSelectSpot!(p.spot))
        }
        marker.addTo(group)
      })

      if (latlngs.length === 1) {
        map.setView(latlngs[0], 14)
      } else {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })
      }
    })
    return () => { cancelled = true }
  }, [items, onSelectSpot])

  return (
    <div
      ref={elRef}
      role="region"
      aria-label="Crawl route map"
      className={className ?? 'w-full h-56 sm:h-72 rounded-xl border-2 border-night-900 overflow-hidden shadow-sticker'}
    />
  )
}
