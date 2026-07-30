import { useEffect, useRef } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { EventCheckin, EventStop } from '../../lib/types'
import type { EventPhase } from '../../lib/eventPhase'

function RouteMap({ stops }: { stops: EventStop[] }) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mapRef.current
    if (!el || stops.length === 0) return
    const latlngs = stops
      .filter(s => s.spot_lat != null && s.spot_lng != null)
      .map(s => [s.spot_lat!, s.spot_lng!] as [number, number])
    if (latlngs.length === 0) return

    let map: import('leaflet').Map | null = null

    import('leaflet').then(L => {
      if (!el || el.dataset.leafletInit) return
      el.dataset.leafletInit = '1'

      map = L.map(el, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
        // One-finger drags trap vertical page scrolling on mobile.
        dragging: !L.Browser.mobile,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: '#fa5a2e', weight: 3, opacity: 0.75 }).addTo(map)
      }

      latlngs.forEach((ll, idx) => {
        const icon = L.divIcon({
          html: `<div style="width:28px;height:28px;border-radius:50%;background:#fa5a2e;color:white;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${idx + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          className: '',
        })
        L.marker(ll, { icon }).addTo(map!)
      })

      if (latlngs.length === 1) {
        map.setView(latlngs[0], 15)
      } else {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [24, 24] })
      }
    })

    return () => {
      if (map) {
        map.remove()
        delete el.dataset.leafletInit
      }
    }
  }, [stops])

  if (stops.length === 0) return null

  return (
    <div
      ref={mapRef}
      className="w-full h-56 rounded-xl overflow-hidden border-2 border-night-900 shadow-sticker"
    />
  )
}

interface Props {
  phase: EventPhase
  stops: EventStop[]
  signedIn: boolean
  checkedInStopIds: Set<string>
  myCheckins: EventCheckin[]
  checkinSubmitting: string | null
  loadingReviewId: string | null
  unlockLabel: string | null   // e.g. "Aug 8" — when check-ins open
  onCheckIn: (stop: EventStop) => void
  onAddReview: (stop: EventStop) => void
  onEditReview: (reviewId: string) => void
}

export default function EventRoute({
  phase, stops, signedIn, checkedInStopIds, myCheckins,
  checkinSubmitting, loadingReviewId, unlockLabel,
  onCheckIn, onAddReview, onEditReview,
}: Props) {
  if (phase === 'announced') {
    return (
      <section>
        <h3 className="font-display uppercase text-lg text-night-900 tracking-tightest mb-3 px-1">The Route</h3>
        <div className="card px-5 py-8 text-center">
          <p className="text-3xl mb-2">📍</p>
          <p className="font-display uppercase text-xl text-night-900 tracking-tightest">Route drops soon 👀</p>
          <p className="text-sm text-charcoal-500 mt-2 max-w-xs mx-auto">
            The stops are being scouted. RSVP so you don't miss the drop.
          </p>
        </div>
      </section>
    )
  }

  const locked = phase === 'route_live'
  const showActions = signedIn && (phase === 'route_live' || phase === 'crawl_day')

  return (
    <section>
      <h3 className="font-display uppercase text-lg text-night-900 tracking-tightest mb-3 px-1">The Route</h3>
      {stops.length > 0 && (
        <div className="mb-4">
          <RouteMap stops={stops} />
        </div>
      )}
      {stops.length === 0 ? (
        <div className="card px-5 py-8 text-center">
          <p className="font-display uppercase text-xl text-night-900 tracking-tightest">Route drops soon 👀</p>
          <p className="text-sm text-charcoal-500 mt-2">The stops are being scouted.</p>
        </div>
      ) : (
        <ol className="space-y-3">
          {stops.map((stop, idx) => {
            const isCheckedIn = checkedInStopIds.has(stop.id)
            const isLoading = checkinSubmitting === stop.id
            const myCheckin = myCheckins.find(c => c.event_stop_id === stop.id)
            const hasReview = !!myCheckin?.review_id
            const isLoadingThisReview = !!myCheckin?.review_id && loadingReviewId === myCheckin.review_id
            return (
              <li key={stop.id} className={`card px-4 py-4 ${isCheckedIn ? 'bg-gold-50 shadow-sticker-gold' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full border-2 border-night-900 flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    isCheckedIn
                      ? 'bg-sauce-400 text-cream-50'
                      : 'bg-cream-200 text-night-800'
                  }`}>
                    {isCheckedIn ? '✓' : idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-night-900">{stop.spot_name}</p>
                    <p className="text-xs text-charcoal-500 truncate mt-0.5">{stop.spot_address}</p>
                    {stop.planned_arrival && (
                      <p className="text-xs text-charcoal-500 mt-1">
                        ⏰ {format(new Date(stop.planned_arrival), 'h:mm a')}
                      </p>
                    )}
                    {stop.notes && (
                      <p className="text-xs text-charcoal-600 mt-1 italic">{stop.notes}</p>
                    )}
                    {stop.parking_notes && (
                      <p className="text-xs text-charcoal-600 mt-1">🅿️ {stop.parking_notes}</p>
                    )}
                    {(stop.checkin_count ?? 0) > 0 && (
                      <p className="text-xs text-charcoal-500 mt-1">
                        {stop.checkin_count} {stop.checkin_count === 1 ? 'check-in' : 'check-ins'}
                      </p>
                    )}

                    {showActions && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {locked ? (
                          <button
                            onClick={() => toast(`Check-ins unlock ${unlockLabel ?? 'on crawl day'} 🍗`)}
                            className="px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-crowd bg-cream-200 text-charcoal-500 border-2 border-night-900/20"
                          >
                            🔒 Unlocks {unlockLabel ?? 'crawl day'}
                          </button>
                        ) : isCheckedIn ? (
                          <span className="px-3 py-2 rounded-xl bg-gold-100 text-gold-700 border-2 border-gold-300 text-xs font-extrabold uppercase tracking-crowd">
                            ✓ Checked in
                          </span>
                        ) : (
                          <button
                            onClick={() => onCheckIn(stop)}
                            disabled={isLoading}
                            className="btn-primary px-4 py-2 text-xs"
                          >
                            {isLoading ? '…' : '📍 Check in'}
                          </button>
                        )}
                        {!locked && (
                          <button
                            onClick={() => {
                              if (hasReview && myCheckin?.review_id) {
                                onEditReview(myCheckin.review_id)
                              } else {
                                onAddReview(stop)
                              }
                            }}
                            disabled={isLoadingThisReview}
                            className="btn-secondary px-4 py-2 text-xs disabled:opacity-50"
                          >
                            ✏️ {isLoadingThisReview
                              ? 'Loading…'
                              : isCheckedIn ? (hasReview ? 'Edit review' : 'Add review') : 'Check in + review'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
