import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import AppHeader from '../components/AppHeader'
import type { WingEvent } from '../lib/types'

export default function EventsIndex() {
  const [events, setEvents] = useState<WingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    supabase
      .from('events_with_counts')
      .select('*')
      .eq('is_published', true)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError("Couldn't load the crawls. Give it another shot.")
          setEvents([])
        } else {
          setEvents((data ?? []) as WingEvent[])
        }
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [reloadKey])

  const now = Date.now()
  const upcoming = events.filter(e => !e.ends_at || new Date(e.ends_at).getTime() >= now)
  const past = events.filter(e => e.ends_at && new Date(e.ends_at).getTime() < now)

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>Crawls — WingKingTony</title>
      </Helmet>

      <AppHeader />

      <header className="border-b-2 border-night-900 bg-cream-100">
        <div className="max-w-2xl mx-auto px-5 py-6">
          <p className="eyebrow mb-1">Group business</p>
          <h1 className="font-display uppercase text-4xl text-night-900 leading-none tracking-tightest">
            Crawls
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-safe-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="card px-6 py-12 text-center">
            <p className="text-4xl mb-3">🧯</p>
            <p className="font-display uppercase text-xl text-night-900 mb-2">Couldn't load crawls</p>
            <p className="text-sm text-charcoal-600 mb-5">{error}</p>
            <button onClick={() => setReloadKey(k => k + 1)} className="btn-secondary">
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="relative card px-6 py-12 text-center overflow-hidden">
            <div aria-hidden className="absolute inset-0 bg-splatter opacity-10 pointer-events-none" />
            <div className="relative">
              <p className="text-5xl mb-3">🍗</p>
              <p className="font-display uppercase text-xl text-night-900 mb-1">No crawls yet</p>
              <p className="text-sm text-charcoal-600">Check back soon — the next route is brewing.</p>
            </div>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <h2 className="eyebrow mb-3 px-1">Upcoming</h2>
                <div className="space-y-3">
                  {upcoming.map(e => <EventCard key={e.id} event={e} highlight />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="eyebrow mb-3 px-1 !text-charcoal-400">Past</h2>
                <div className="space-y-3">
                  {past.map(e => <EventCard key={e.id} event={e} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function EventCard({ event, highlight = false }: { event: WingEvent; highlight?: boolean }) {
  const navigate = useNavigate()
  const startsAt = event.starts_at ? new Date(event.starts_at) : null
  const endsAt = event.ends_at ? new Date(event.ends_at) : null
  const dateLabel = startsAt
    ? (endsAt && endsAt.toDateString() !== startsAt.toDateString()
        ? `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
        : format(startsAt, 'EEE, MMM d, yyyy'))
    : null

  return (
    <button
      onClick={() => navigate(`/events/${event.slug}`)}
      className={`card overflow-hidden w-full text-left transition-all hover:shadow-sticker hover:-translate-y-0.5 ${
        highlight ? 'shadow-sticker-sauce' : ''
      }`}
    >
      {event.cover_image_url ? (
        <img src={event.cover_image_url} alt="" className="w-full h-32 object-cover border-b-2 border-night-900" />
      ) : (
        <div className="w-full h-24 bg-night-800 bg-halftone-dark border-b-2 border-night-900 flex items-center justify-center">
          <span className="text-4xl">🍗</span>
        </div>
      )}
      <div className="px-5 py-4">
        <h3 className="font-display uppercase text-xl text-night-900 tracking-tightest leading-tight mb-1">
          {event.name}
        </h3>
        {dateLabel && (
          <p className="text-sm text-charcoal-600 font-bold">{dateLabel}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs font-bold text-charcoal-500 uppercase tracking-crowd">
          <span>👥 {event.going_count ?? 0} going</span>
          <span>📍 {event.stop_count ?? 0} stops</span>
        </div>
      </div>
    </button>
  )
}
