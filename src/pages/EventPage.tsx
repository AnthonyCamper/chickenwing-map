import { useEffect, useRef, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { AuthState } from '../hooks/useAuth'
import { useEvent } from '../hooks/useEvent'
import { useReviews } from '../hooks/useReviews'
import { useBadges } from '../hooks/useBadges'
import ReviewFormModal from '../components/ReviewFormModal'
import BadgeGrid from '../components/badges/BadgeGrid'
import { supabase } from '../lib/supabase'
import type { EventStop, ReviewFormData, RsvpStatus } from '../lib/types'

interface CheckinAttendee {
  user_id: string
  display_name: string
  avatar_url: string | null
  stop_count: number
  badges: Array<{ id: string; name: string; icon: string; color: string }>
}

interface RouteMapProps {
  stops: EventStop[]
}

function RouteMap({ stops }: RouteMapProps) {
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

      map = L.map(el, { zoomControl: true, attributionControl: false })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map)

      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: '#f59e0b', weight: 3, opacity: 0.75 }).addTo(map)
      }

      latlngs.forEach((ll, idx) => {
        const icon = L.divIcon({
          html: `<div style="width:28px;height:28px;border-radius:50%;background:#f59e0b;color:white;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3)">${idx + 1}</div>`,
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
      className="w-full h-56 rounded-2xl overflow-hidden border border-warmgray-200 shadow-soft"
    />
  )
}

interface Props {
  auth: AuthState
}

export default function EventPage({ auth }: Props) {
  const { slug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()
  const userId = auth.user?.id ?? null
  const evt = useEvent(slug ?? null, userId)
  const reviews = useReviews()
  const badges = useBadges(userId)

  const [reviewingStop, setReviewingStop] = useState<EventStop | null>(null)
  const [rsvpSubmitting, setRsvpSubmitting] = useState<RsvpStatus | null>(null)
  const [checkinSubmitting, setCheckinSubmitting] = useState<string | null>(null)
  const [checkinAttendees, setCheckinAttendees] = useState<CheckinAttendee[]>([])
  const [resetConfirmUserId, setResetConfirmUserId] = useState<string | null>(null)
  const [resetingUserId, setResetingUserId] = useState<string | null>(null)

  const handleResetProgress = async (targetUserId: string) => {
    const eventId = evt.event?.id
    if (!eventId) return
    setResetingUserId(targetUserId)
    try {
      await Promise.all([
        supabase.from('event_checkins').delete().match({ event_id: eventId, user_id: targetUserId }),
        supabase.from('reviews').delete().match({ event_id: eventId, user_id: targetUserId }),
        supabase.from('user_badges').delete().match({ event_id: eventId, user_id: targetUserId }),
      ])
      const name = checkinAttendees.find(a => a.user_id === targetUserId)?.display_name ?? 'User'
      toast.success(`Reset ${name}'s progress`)
      setCheckinAttendees(prev => prev.filter(a => a.user_id !== targetUserId))
      if (targetUserId === userId) await evt.refresh()
    } catch {
      toast.error('Reset failed — try again')
    } finally {
      setResetingUserId(null)
      setResetConfirmUserId(null)
    }
  }

  const checkedInStopIds = useMemo(
    () => new Set(evt.myCheckins.map(c => c.event_stop_id)),
    [evt.myCheckins]
  )

  const completionPct = evt.stops.length === 0
    ? 0
    : Math.round((checkedInStopIds.size / evt.stops.length) * 100)

  // Filter badges scoped to this event (or recently earned globals)
  const eventBadges = useMemo(
    () => badges.badges.filter(b => b.event_id === evt.event?.id),
    [badges.badges, evt.event?.id]
  )

  // Fetch all checked-in attendees with their badges
  useEffect(() => {
    const eventId = evt.event?.id
    if (!eventId) { setCheckinAttendees([]); return }
    let cancelled = false
    const load = async () => {
      const { data: checkins } = await supabase
        .from('event_checkins')
        .select('user_id, event_stop_id')
        .eq('event_id', eventId)
      if (cancelled || !checkins?.length) { setCheckinAttendees([]); return }

      const stopCountMap = new Map<string, number>()
      for (const c of checkins) {
        stopCountMap.set(c.user_id, (stopCountMap.get(c.user_id) ?? 0) + 1)
      }
      const userIds = [...stopCountMap.keys()]

      const [profilesRes, badgesRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, full_name, avatar_url, email, is_private').in('id', userIds),
        supabase.from('user_badges').select('user_id, badges!inner(id, name, icon, color)').in('user_id', userIds),
      ])
      if (cancelled) return

      type UBRow = { user_id: string; badges: { id: string; name: string; icon: string; color: string } }
      const badgesMap = new Map<string, Array<{ id: string; name: string; icon: string; color: string }>>()
      for (const ub of (badgesRes.data ?? []) as unknown as UBRow[]) {
        const arr = badgesMap.get(ub.user_id) ?? []
        arr.push(ub.badges)
        badgesMap.set(ub.user_id, arr)
      }

      const attendees: CheckinAttendee[] = (profilesRes.data ?? [])
        .filter((p: { id: string; is_private?: boolean }) => !p.is_private || p.id === userId || auth.isAdmin)
        .map((p: { id: string; display_name: string | null; full_name: string | null; avatar_url: string | null; email: string | null }) => ({
          user_id: p.id,
          display_name: p.display_name ?? p.full_name ?? p.email ?? 'Unknown',
          avatar_url: p.avatar_url ?? null,
          stop_count: stopCountMap.get(p.id) ?? 0,
          badges: badgesMap.get(p.id) ?? [],
        }))
      attendees.sort((a, b) => b.stop_count - a.stop_count)
      setCheckinAttendees(attendees)
    }
    load()
    return () => { cancelled = true }
  }, [evt.event?.id, evt.myCheckins])

  if (evt.loading) {
    return (
      <div className="min-h-dvh bg-warmgray-50 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
      </div>
    )
  }

  if (!evt.event) {
    return (
      <div className="min-h-dvh bg-warmgray-50 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl mb-3">🍗</p>
        <h2 className="font-display text-xl text-charcoal-800 mb-2">No active event</h2>
        <p className="text-sm text-charcoal-400 mb-6">There's no published crawl right now. Check back soon.</p>
        <button onClick={() => navigate('/')} className="btn-secondary">Back home</button>
      </div>
    )
  }

  const e = evt.event
  const startsAt = e.starts_at ? new Date(e.starts_at) : null
  const endsAt   = e.ends_at   ? new Date(e.ends_at)   : null
  const dateRange = (() => {
    if (!startsAt) return null
    if (endsAt && endsAt.toDateString() !== startsAt.toDateString()) {
      return `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
    }
    return format(startsAt, 'EEEE, MMM d, yyyy')
  })()

  const handleRsvp = async (status: RsvpStatus) => {
    if (!userId) { toast.error('Sign in to RSVP'); return }
    setRsvpSubmitting(status)
    const { error } = await evt.setRsvp(status)
    setRsvpSubmitting(null)
    if (error) {
      toast.error(error)
    } else {
      // Refresh badges (RSVP may have just earned the "I'm In" badge)
      badges.refresh()
      toast.success(
        status === 'going' ? "You're in! 🍗" :
        status === 'maybe' ? 'Marked as maybe' :
        'Marked as not going'
      )
    }
  }

  const handleCheckIn = async (stop: EventStop) => {
    if (!userId) { toast.error('Sign in first'); return }
    if (evt.myRsvp?.status !== 'going') { toast.error("Join the crawl first before checking in!"); return }
    setCheckinSubmitting(stop.id)
    const { error } = await evt.checkIn(stop.id)
    setCheckinSubmitting(null)
    if (error) {
      toast.error(error)
    } else {
      badges.refresh()
      toast.success(`Checked in at ${stop.spot_name}! 🍗`)
    }
  }

  const handleSubmitReview = async (data: ReviewFormData) => {
    if (!reviewingStop) return { error: 'No stop selected' }
    if (evt.myRsvp?.status !== 'going') return { error: 'Join the crawl first before leaving a review!' }
    const result = await reviews.createReview(data, userId ?? '')
    if (!result.error) {
      // Ensure a checkin exists and link this review to it
      if (result.reviewId) {
        await evt.checkIn(reviewingStop.id, result.reviewId)
      }
      badges.refresh()
      setReviewingStop(null)
    }
    return { error: result.error }
  }

  return (
    <div className="min-h-dvh bg-warmgray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-warmgray-50/95 backdrop-blur-md border-b border-warmgray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="btn-ghost px-2 py-1.5 text-charcoal-500 text-sm"
            aria-label="Back"
          >
            ← Back
          </button>
          <h1 className="font-display text-base text-charcoal-800 flex-1 truncate">{e.name}</h1>
          <button
            onClick={async () => {
              const url = `${window.location.origin}/events/${e.slug}`
              const shareData = {
                title: e.name,
                text: `Join me at ${e.name}! 🍗`,
                url,
              }
              if (typeof navigator !== 'undefined' && navigator.share) {
                try {
                  await navigator.share(shareData)
                  return
                } catch (err) {
                  // User cancelled or share failed — fall through to clipboard
                  if (err instanceof Error && err.name === 'AbortError') return
                }
              }
              try {
                await navigator.clipboard.writeText(url)
                toast.success('Link copied!')
              } catch {
                toast.error('Could not copy link')
              }
            }}
            className="btn-ghost px-2 py-1.5 text-charcoal-500 text-sm flex items-center gap-1"
            aria-label="Share event"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hero */}
        <section className="card overflow-hidden">
          {e.cover_image_url ? (
            <img src={e.cover_image_url} alt="" className="w-full h-44 object-cover" />
          ) : (
            <div className="w-full h-32 bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center">
              <span className="text-6xl">🍗</span>
            </div>
          )}
          <div className="px-5 py-4">
            <h2 className="font-display text-2xl text-charcoal-800 mb-1">{e.name}</h2>
            {dateRange && (
              <p className="text-sm text-charcoal-400 font-medium">{dateRange}</p>
            )}
            {e.description && (
              <p className="text-sm text-charcoal-500 mt-3 leading-relaxed whitespace-pre-wrap">
                {e.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-4 text-xs text-charcoal-400">
              <span>👥 {e.going_count ?? 0} going</span>
              <span>📍 {e.stop_count ?? evt.stops.length} stops</span>
              {evt.myRsvp && evt.myRsvp.status === 'going' && (
                <span className="text-amber-600 font-semibold">✓ You're in</span>
              )}
            </div>
          </div>
        </section>

        {/* Join CTA / RSVP */}
        {userId && (
          evt.myRsvp?.status === 'going' ? (
            <section className="card px-5 py-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✋</span>
                  <div>
                    <p className="font-semibold text-charcoal-800 text-sm">You're in!</p>
                    <p className="text-xs text-charcoal-400">See you at the crawl</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('Drop your RSVP?')) return
                    const { error } = await evt.removeRsvp()
                    if (error) toast.error(error)
                    else toast.success('RSVP removed')
                  }}
                  className="text-xs text-charcoal-400 hover:text-red-500 transition-colors"
                >
                  Drop out
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['maybe', 'not_going'] as RsvpStatus[]).map(s => {
                  const label = s === 'maybe' ? 'Change to Maybe' : "Can't make it"
                  return (
                    <button
                      key={s}
                      onClick={() => handleRsvp(s)}
                      disabled={rsvpSubmitting !== null}
                      className="px-3 py-2 rounded-xl text-xs font-medium border bg-white text-charcoal-500 border-warmgray-200 hover:border-amber-300 disabled:opacity-60 transition-all"
                    >
                      {rsvpSubmitting === s ? '…' : label}
                    </button>
                  )
                })}
              </div>
            </section>
          ) : evt.myRsvp ? (
            <section className="card px-5 py-4">
              <p className="text-sm text-charcoal-500 mb-3">
                You said: <strong className="text-charcoal-700">
                  {evt.myRsvp.status === 'maybe' ? 'Maybe' : "Can't make it"}
                </strong>
              </p>
              <button
                onClick={() => handleRsvp('going')}
                disabled={rsvpSubmitting !== null}
                className="btn-primary w-full text-base py-3.5"
              >
                {rsvpSubmitting === 'going' ? 'Joining…' : '✋ Join the Crawl'}
              </button>
            </section>
          ) : (
            <section>
              <button
                onClick={() => handleRsvp('going')}
                disabled={rsvpSubmitting !== null}
                className="btn-primary w-full text-base py-4 shadow-elevated"
              >
                {rsvpSubmitting === 'going' ? 'Joining…' : '✋ Join the Crawl'}
              </button>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => handleRsvp('maybe')}
                  disabled={rsvpSubmitting !== null}
                  className="px-3 py-2 rounded-xl text-xs font-medium border bg-white text-charcoal-500 border-warmgray-200 hover:border-amber-300 disabled:opacity-60 transition-all"
                >
                  🤔 Maybe
                </button>
                <button
                  onClick={() => handleRsvp('not_going')}
                  disabled={rsvpSubmitting !== null}
                  className="px-3 py-2 rounded-xl text-xs font-medium border bg-white text-charcoal-500 border-warmgray-200 hover:border-amber-300 disabled:opacity-60 transition-all"
                >
                  🙅 Can't make it
                </button>
              </div>
            </section>
          )
        )}

        {/* Progress bar (when RSVP'd and stops exist) */}
        {evt.myRsvp?.status === 'going' && evt.stops.length > 0 && (
          <section className="card px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-base text-charcoal-800">Your progress</h3>
              <span className="text-sm font-semibold text-amber-600">
                {checkedInStopIds.size}/{evt.stops.length}
              </span>
            </div>
            <div className="h-2 bg-warmgray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            {completionPct === 100 && (
              <p className="text-xs text-amber-600 font-semibold mt-2">🏆 Crawl complete!</p>
            )}
          </section>
        )}

        {/* Route */}
        <section>
          <h3 className="font-display text-lg text-charcoal-800 mb-3 px-1">The Route</h3>
          {evt.stops.length > 0 && (
            <div className="mb-4">
              <RouteMap stops={evt.stops} />
            </div>
          )}
          {evt.stops.length === 0 ? (
            <div className="card px-5 py-8 text-center text-charcoal-400">
              <p className="text-sm">No stops have been added yet.</p>
            </div>
          ) : (
            <ol className="space-y-3">
              {evt.stops.map((stop, idx) => {
                const isCheckedIn = checkedInStopIds.has(stop.id)
                const isLoading = checkinSubmitting === stop.id
                const myCheckin = evt.myCheckins.find(c => c.event_stop_id === stop.id)
                const hasReview = !!myCheckin?.review_id
                return (
                  <li key={stop.id} className={`card px-4 py-4 ${isCheckedIn ? 'bg-amber-50/50 border-amber-200' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        isCheckedIn
                          ? 'bg-amber-400 text-white'
                          : 'bg-warmgray-100 text-charcoal-500'
                      }`}>
                        {isCheckedIn ? '✓' : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-charcoal-800">{stop.spot_name}</p>
                        <p className="text-xs text-charcoal-400 truncate mt-0.5">{stop.spot_address}</p>
                        {stop.planned_arrival && (
                          <p className="text-xs text-charcoal-400 mt-1">
                            ⏰ {format(new Date(stop.planned_arrival), 'h:mm a')}
                          </p>
                        )}
                        {stop.notes && (
                          <p className="text-xs text-charcoal-500 mt-1 italic">{stop.notes}</p>
                        )}
                        {stop.parking_notes && (
                          <p className="text-xs text-charcoal-500 mt-1">🅿️ {stop.parking_notes}</p>
                        )}
                        {stop.checkin_count && stop.checkin_count > 0 && (
                          <p className="text-xs text-charcoal-300 mt-1">
                            {stop.checkin_count} {stop.checkin_count === 1 ? 'check-in' : 'check-ins'}
                          </p>
                        )}

                        {userId && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {!isCheckedIn ? (
                              <button
                                onClick={() => handleCheckIn(stop)}
                                disabled={isLoading}
                                className="btn-primary px-4 py-2 text-xs"
                              >
                                {isLoading ? '…' : '📍 Check in'}
                              </button>
                            ) : (
                              <span className="px-3 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-semibold">
                                ✓ Checked in
                              </span>
                            )}
                            <button
                              onClick={() => {
                                if (evt.myRsvp?.status !== 'going') { toast.error('Join the crawl first!'); return }
                                setReviewingStop(stop)
                              }}
                              className="btn-secondary px-4 py-2 text-xs"
                            >
                              ✏️ {isCheckedIn ? (hasReview ? 'Edit review' : 'Add review') : 'Check in + review'}
                            </button>
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

        {/* Event badges */}
        {eventBadges.length > 0 && (
          <section>
            <h3 className="font-display text-lg text-charcoal-800 mb-3 px-1">Event Badges</h3>
            <BadgeGrid badges={eventBadges} />
          </section>
        )}

        {/* Checked-in attendees with badges */}
        {checkinAttendees.length > 0 && (
          <section className="card px-5 py-4">
            <h3 className="font-display text-base text-charcoal-800 mb-3">
              Checked in ({checkinAttendees.length})
            </h3>
            <ul className="space-y-3">
              {checkinAttendees.map(a => (
                <li key={a.user_id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    {a.avatar_url ? (
                      <img src={a.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center text-sm font-bold text-amber-700 flex-shrink-0">
                        {a.display_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-charcoal-700 truncate">{a.display_name}</p>
                      <p className="text-xs text-charcoal-400">
                        {a.stop_count}/{evt.stops.length} {a.stop_count === 1 ? 'stop' : 'stops'}
                      </p>
                    </div>
                    {a.badges.length > 0 && (
                      <div className="flex items-center flex-shrink-0">
                        {a.badges.slice(0, 6).map((b, i) => (
                          <span
                            key={b.id}
                            title={b.name}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white shadow-sm"
                            style={{
                              backgroundColor: b.color,
                              marginLeft: i > 0 ? '-8px' : 0,
                              zIndex: a.badges.length - i,
                              position: 'relative',
                            }}
                          >
                            {b.icon}
                          </span>
                        ))}
                        {a.badges.length > 6 && (
                          <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-warmgray-200 text-charcoal-500 border-2 border-white shadow-sm"
                            style={{ marginLeft: '-8px', position: 'relative', zIndex: 0 }}
                          >
                            +{a.badges.length - 6}
                          </span>
                        )}
                      </div>
                    )}
                    {auth.isAdmin && (
                      <button
                        onClick={() => setResetConfirmUserId(resetConfirmUserId === a.user_id ? null : a.user_id)}
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-charcoal-300 hover:text-sauce-500 hover:bg-sauce-50 transition-colors"
                        title="Reset progress"
                        disabled={resetingUserId === a.user_id}
                      >
                        {resetingUserId === a.user_id ? (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-sauce-400 border-t-transparent animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {auth.isAdmin && resetConfirmUserId === a.user_id && (
                    <div className="ml-12 flex items-center gap-2 py-2 px-3 bg-sauce-50 border border-sauce-200 rounded-xl">
                      <p className="text-xs font-semibold text-sauce-700 flex-1">
                        Reset {a.display_name}'s check-ins, reviews & badges?
                      </p>
                      <button
                        onClick={() => setResetConfirmUserId(null)}
                        className="text-xs font-bold text-charcoal-500 hover:text-charcoal-700 px-2 py-1 rounded-lg hover:bg-warmgray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleResetProgress(a.user_id)}
                        disabled={!!resetingUserId}
                        className="text-xs font-extrabold text-cream-50 bg-sauce-500 hover:bg-sauce-600 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Going list */}
        {evt.rsvps.filter(r => r.status === 'going').length > 0 && (
          <section className="card px-5 py-4">
            <h3 className="font-display text-base text-charcoal-800 mb-3">
              Who's coming ({evt.rsvps.filter(r => r.status === 'going').length})
            </h3>
            <ul className="flex flex-wrap gap-2">
              {evt.rsvps
                .filter(r => r.status === 'going')
                .map(r => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warmgray-50 border border-warmgray-200"
                  >
                    {r.is_private ? (
                      <span className="w-5 h-5 rounded-full bg-warmgray-200 flex items-center justify-center text-xs">🔒</span>
                    ) : r.user_avatar ? (
                      <img src={r.user_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-700">
                        {(r.user_name ?? r.user_email ?? '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs font-medium text-charcoal-600">
                      {r.is_private ? 'Private' : (r.user_name ?? r.user_email)}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </main>

      {reviewingStop && (
        <ReviewFormModal
          onClose={() => setReviewingStop(null)}
          onSubmit={handleSubmitReview}
          prefill={{
            shop_name: reviewingStop.spot_name ?? '',
            address: reviewingStop.spot_address ?? '',
            lat: reviewingStop.spot_lat ?? 0,
            lng: reviewingStop.spot_lng ?? 0,
          }}
          eventContext={{
            event_id: e.id,
            event_stop_id: reviewingStop.id,
            event_name: e.name,
          }}
        />
      )}
    </div>
  )
}
