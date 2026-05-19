import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { WingEvent } from '../lib/types'

export default function EventsIndex() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<WingEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('events_with_counts')
      .select('*')
      .eq('is_published', true)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setEvents((data ?? []) as WingEvent[])
        setLoading(false)
      })
  }, [])

  const now = Date.now()
  const upcoming = events.filter(e => !e.ends_at || new Date(e.ends_at).getTime() >= now)
  const past = events.filter(e => e.ends_at && new Date(e.ends_at).getTime() < now)

  return (
    <div className="min-h-dvh bg-warmgray-50">
      <header className="sticky top-0 z-40 bg-warmgray-50/95 backdrop-blur-md border-b border-warmgray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="btn-ghost px-2 py-1.5 text-charcoal-500 text-sm"
            aria-label="Back"
          >
            ← Back
          </button>
          <h1 className="font-display text-base text-charcoal-800 flex-1">Events</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="text-5xl mb-3">🍗</p>
            <p className="font-display text-lg text-charcoal-700 mb-1">No events yet</p>
            <p className="text-sm text-charcoal-400">Check back soon for upcoming crawls.</p>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-charcoal-400 mb-3 px-1">
                  Upcoming
                </h2>
                <div className="space-y-3">
                  {upcoming.map(e => <EventCard key={e.id} event={e} highlight />)}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-charcoal-400 mb-3 px-1">
                  Past
                </h2>
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
      className={`card overflow-hidden w-full text-left hover:shadow-md transition-shadow ${
        highlight ? 'ring-1 ring-amber-200' : ''
      }`}
    >
      {event.cover_image_url ? (
        <img src={event.cover_image_url} alt="" className="w-full h-32 object-cover" />
      ) : (
        <div className="w-full h-24 bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center">
          <span className="text-4xl">🍗</span>
        </div>
      )}
      <div className="px-5 py-4">
        <h3 className="font-display text-lg text-charcoal-800 mb-1">{event.name}</h3>
        {dateLabel && (
          <p className="text-sm text-charcoal-500 font-medium">{dateLabel}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-charcoal-400">
          <span>👥 {event.going_count ?? 0} going</span>
          <span>📍 {event.stop_count ?? 0} stops</span>
        </div>
      </div>
    </button>
  )
}
