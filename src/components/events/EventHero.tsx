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
        // Show the whole poster (never crop it — see 40d586d), but fill the
        // letterbox with a blurred copy of the same image so the spare space
        // reads as intentional instead of an empty dark band.
        <div className="relative overflow-hidden bg-night-900 border-b-2 border-night-900">
          <img
            src={event.cover_image_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70"
          />
          <img
            src={event.cover_image_url}
            alt=""
            className="relative block mx-auto w-auto h-auto max-w-full max-h-80"
          />
        </div>
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
        <h2 className="font-display uppercase text-2xl text-night-900 tracking-tightest mb-1 break-words [overflow-wrap:anywhere]">{event.name}</h2>
        {dateRange && (
          <p className="text-sm text-charcoal-600 font-bold">
            {phase === 'wrapped' ? `Went down ${dateRange}` : dateRange}
          </p>
        )}
        {event.description && (
          <p className="text-sm text-charcoal-600 mt-3 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {event.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs font-bold text-charcoal-500 uppercase tracking-crowd">
          <span>👥 {goingCount} {phase === 'wrapped' ? 'crawled' : 'going'}</span>
          {phase === 'announced' ? (
            <span>📍 Stops announced soon</span>
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
