import { useEffect, useRef, useState } from 'react'
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

/** First mention of "crawl" on the page: say what it is in plain words. */
export const CRAWL_EXPLAINER = 'A wing crawl: visit several wing spots in one day and rate each one.'

export default function EventHero({ event, phase, dateRange, goingCount, stopCount, isGoing }: Props) {
  return (
    <section className="card overflow-hidden">
      {event.cover_image_url ? (
        <EventCover url={event.cover_image_url} name={event.name} />
      ) : (
        <div className="w-full h-32 bg-night-800 bg-halftone-dark border-b-2 border-night-900 flex items-center justify-center">
          <span className="text-6xl">🍗</span>
        </div>
      )}
      <div className="px-5 py-4">
        {phase === 'wrapped' && (
          <p className="eyebrow text-gold-500 mb-1">Event finished 🏁</p>
        )}
        {phase === 'crawl_day' && (
          <p className="eyebrow text-sauce-500 mb-1">Happening now 🔥</p>
        )}
        <h2 className="font-display uppercase text-2xl text-night-900 tracking-tightest mb-1 break-words [overflow-wrap:anywhere]">{event.name}</h2>
        {dateRange && (
          <p className="text-sm text-charcoal-600 font-bold">
            {phase === 'wrapped' ? `Took place ${dateRange}` : dateRange}
          </p>
        )}
        <p className="text-xs text-charcoal-500 mt-1">{CRAWL_EXPLAINER}</p>
        {event.description && (
          <p className="text-sm text-charcoal-600 mt-3 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
            {event.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs font-bold text-charcoal-500 uppercase tracking-crowd">
          <span>👥 {goingCount} {phase === 'wrapped' ? 'went' : 'going'}</span>
          {phase === 'announced' ? (
            <span>📍 Stops announced soon</span>
          ) : (
            <span>📍 {stopCount} {stopCount === 1 ? 'stop' : 'stops'}</span>
          )}
          {isGoing && phase !== 'wrapped' && (
            <span className="text-sauce-500 font-extrabold">✓ You're in</span>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * The cover poster. Space is reserved up front (fixed height, so nothing
 * jumps), and a light gradient with the event name shows until the image
 * has fully loaded, then the image fades in. Before, a big cover on slow 3G
 * drew as a dark block for a minute or more.
 */
function EventCover({ url, name }: { url: string; name: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    // Already in the browser cache: the load event may have fired before
    // React attached its handler.
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) setState('loaded')
  }, [url])

  const loaded = state === 'loaded'

  return (
    <div className="relative h-64 sm:h-80 overflow-hidden border-b-2 border-night-900 bg-gradient-to-br from-sauce-300 via-sauce-400 to-ember-300">
      {/* Placeholder: readable title on a light gradient (not a dark block) */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
      >
        <span className="text-4xl">🍗</span>
        <p className="font-display uppercase text-2xl text-night-900 leading-tight tracking-tightest line-clamp-3 break-words [overflow-wrap:anywhere]">
          {name}
        </p>
        {state === 'loading' && (
          <p className="text-[10px] font-extrabold uppercase tracking-crowd text-night-900/70">Loading photo…</p>
        )}
      </div>

      {state !== 'failed' && (
        <>
          {/* Blurred copy fills the letterbox around the whole (uncropped)
              poster — see 40d586d. Same URL, so no extra download. */}
          <img
            src={url}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full object-cover scale-110 blur-2xl transition-opacity duration-500 ${loaded ? 'opacity-70' : 'opacity-0'}`}
          />
          <img
            ref={imgRef}
            src={url}
            alt=""
            decoding="async"
            onLoad={() => setState('loaded')}
            onError={() => setState('failed')}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      )}
    </div>
  )
}
