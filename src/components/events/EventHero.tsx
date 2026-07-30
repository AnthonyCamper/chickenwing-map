import type { WingEvent } from '../../lib/types'
import type { EventPhase } from '../../lib/eventPhase'

interface Props {
  event: WingEvent
  phase: EventPhase
  dateRange: string | null
  goingCount: number
  stopCount: number
  isGoing: boolean
}

export default function EventHero({ event, phase, dateRange, goingCount, stopCount, isGoing }: Props) {
  return (
    <section className="card overflow-hidden">
      {event.cover_image_url ? (
        <img src={event.cover_image_url} alt="" className="w-full max-h-80 object-contain bg-night-900 border-b-2 border-night-900" />
      ) : (
        <div className="w-full h-32 bg-night-800 bg-halftone-dark border-b-2 border-night-900 flex items-center justify-center">
          <span className="text-6xl">🍗</span>
        </div>
      )}
      <div className="px-5 py-4">
        {phase === 'wrapped' && (
          <p className="eyebrow text-gold-500 mb-1">That's a wrap 🏁</p>
        )}
        {phase === 'crawl_day' && (
          <p className="eyebrow text-sauce-500 mb-1">Happening now 🔥</p>
        )}
        <h2 className="font-display uppercase text-2xl text-night-900 tracking-tightest mb-1">{event.name}</h2>
        {dateRange && (
          <p className="text-sm text-charcoal-600 font-bold">
            {phase === 'wrapped' ? `Went down ${dateRange}` : dateRange}
          </p>
        )}
        {event.description && (
          <p className="text-sm text-charcoal-600 mt-3 leading-relaxed whitespace-pre-wrap">
            {event.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs font-bold text-charcoal-500 uppercase tracking-crowd">
          <span>👥 {goingCount} {phase === 'wrapped' ? 'crawled' : 'going'}</span>
          {phase === 'announced' ? (
            <span>📍 Route drops soon</span>
          ) : (
            <span>📍 {stopCount} stops</span>
          )}
          {isGoing && phase !== 'wrapped' && (
            <span className="text-sauce-500 font-extrabold">✓ You're in</span>
          )}
        </div>
      </div>
    </section>
  )
}
