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
 * jumps) with a light gradient and the event name behind it. The image is
 * ONE request and visible from the first byte, so a big cover paints
 * progressively on slow 3G instead of hiding behind "Loading photo…" until
 * the very end (m2 S07: a 2.8 MB cover showed nothing for 100 s+, and was
 * downloaded twice for the blurred backdrop). The blurred letterbox fill is
 * drawn from the loaded image into a tiny canvas: no second download.
 */
function EventCover({ url, name }: { url: string; name: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  const imgRef = useRef<HTMLImageElement>(null)
  const backdropRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setState('loading')
    // Already in the browser cache: the load event may have fired before
    // React attached its handler.
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) setState('loaded')
  }, [url])

  // Blurred backdrop for the letterbox, from the already-decoded image.
  useEffect(() => {
    if (state !== 'loaded') return
    const img = imgRef.current
    const canvas = backdropRef.current
    const ctx = canvas?.getContext('2d')
    if (!img || !canvas || !ctx) return
    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    } catch { /* not drawable: the gradient stays */ }
  }, [state])

  const loaded = state === 'loaded'

  return (
    <div className="relative h-64 sm:h-80 overflow-hidden border-b-2 border-night-900 bg-gradient-to-br from-sauce-300 via-sauce-400 to-ember-300">
      {/* Behind the image: readable title on a light gradient (not a dark
          block) until the photo has painted over it */}
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
          <canvas
            ref={backdropRef}
            width={24}
            height={24}
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full scale-110 blur-2xl transition-opacity duration-500 ${loaded ? 'opacity-70' : 'opacity-0'}`}
          />
          <img
            ref={imgRef}
            src={url}
            alt=""
            onLoad={() => setState('loaded')}
            onError={() => setState('failed')}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </>
      )}
    </div>
  )
}
