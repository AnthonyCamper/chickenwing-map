import type { EventStop } from '../../lib/types'

interface Props {
  stops: EventStop[]
  checkedInStopIds: Set<string>
}

/** Crawl-day scoreboard: progress bar + where to head next. */
export default function EventProgress({ stops, checkedInStopIds }: Props) {
  if (stops.length === 0) return null

  const done = checkedInStopIds.size
  const pct = Math.round((done / stops.length) * 100)
  const nextStop = stops.find(s => !checkedInStopIds.has(s.id))

  return (
    <section className="card px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display uppercase text-base text-night-900 tracking-tightest">Your progress</h3>
        <span className="text-sm font-extrabold text-sauce-500">
          {done}/{stops.length}
        </span>
      </div>
      <div className="h-2 bg-cream-200 rounded-full overflow-hidden border border-night-900/20">
        <div
          className="h-full bg-sauce-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct === 100 ? (
        <p className="text-xs text-gold-500 font-extrabold uppercase tracking-crowd mt-2">🏆 Crawl complete!</p>
      ) : nextStop ? (
        <p className="text-xs text-charcoal-600 mt-2">
          <span className="font-extrabold uppercase tracking-crowd text-charcoal-500">Next up:</span>{' '}
          <span className="font-bold text-night-900">{nextStop.spot_name}</span>
        </p>
      ) : null}
    </section>
  )
}
