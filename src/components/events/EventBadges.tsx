import { useMemo, useState } from 'react'
import BadgeGrid from '../badges/BadgeGrid'
import BadgeIcon from '../badges/BadgeIcon'
import BadgeDetailModal, { howToEarn } from '../badges/BadgeDetailModal'
import { badgeTeaser } from '../../lib/badgeHints'
import type { BadgeWithEarned } from '../../lib/types'
import type { EventPhase } from '../../lib/eventPhase'

interface Props {
  phase: EventPhase
  badges: BadgeWithEarned[]
}

/**
 * Pre-crawl the badge wall would be 20 identical locked pills, so we tease:
 * the easiest wins up front (RSVP badge first — one tap away), the rest
 * behind a "+N more" expander. Crawl day onward shows the full grid.
 */
const FEATURED_PRIORITY = ['event_rsvp', 'event_checkin_count', 'event_first_checkin']

export default function EventBadges({ phase, badges }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<BadgeWithEarned | null>(null)

  const featured = useMemo(() => {
    const ranked = [...badges].sort((a, b) => {
      const ra = FEATURED_PRIORITY.indexOf(a.criteria_type ?? '')
      const rb = FEATURED_PRIORITY.indexOf(b.criteria_type ?? '')
      return (ra === -1 ? FEATURED_PRIORITY.length : ra) - (rb === -1 ? FEATURED_PRIORITY.length : rb)
    })
    return ranked.slice(0, 3)
  }, [badges])

  if (badges.length === 0) return null

  const teasing = (phase === 'announced' || phase === 'route_live') && !expanded
  const hiddenCount = badges.length - featured.length

  return (
    <section>
      <h3 className="font-display uppercase text-lg text-night-900 tracking-tightest mb-3 px-1">Event Badges</h3>
      {teasing ? (
        <>
          <ul className="space-y-2.5">
            {featured.map(b => (
              <li key={b.id}>
                <button
                  onClick={() => setSelected(b)}
                  className="card w-full px-4 py-3 flex items-center gap-3 text-left hover:border-sauce-400 transition-colors"
                >
                  {/* Dark plate like earned pills — the stroke icons vanish on light badge colors */}
                  <span className="relative w-11 h-11 rounded-xl bg-night-800 border-2 border-gold-400 flex items-center justify-center flex-shrink-0 shadow-sticker-sm">
                    <BadgeIcon icon={b.icon} className="w-6 h-6 text-cream-50" />
                    <span
                      aria-hidden="true"
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border border-night-900 bg-gold-300 flex items-center justify-center text-[8px] leading-none"
                    >
                      ★
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold text-sm text-night-900 uppercase tracking-crowd truncate">
                      {b.name}
                      {b.earned && <span className="ml-1.5 text-sauce-500">✓</span>}
                    </span>
                    <span className="block text-xs text-charcoal-500 truncate">
                      {b.earned ? howToEarn(b) : badgeTeaser(b)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full mt-2.5 px-4 py-3 rounded-xl border-2 border-dashed border-night-900/30 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:border-sauce-400 hover:text-sauce-500 transition-colors"
            >
              +{hiddenCount} more to unlock day-of
            </button>
          )}
        </>
      ) : (
        <BadgeGrid badges={badges} />
      )}
      {selected && (
        <BadgeDetailModal badge={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}
