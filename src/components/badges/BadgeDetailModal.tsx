import { useEffect, useState } from 'react'
import { endOfDay, format } from 'date-fns'
import { Link } from 'react-router-dom'
import Modal from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import BadgeIcon from './BadgeIcon'
import { badgeRarity, rarityLine, RARITY_CHIP_CLASSES } from '../../lib/badgeRarity'
import { badgeTeaser, howToEarn } from '../../lib/badgeHints'
import type { BadgeWithEarned } from '../../lib/types'

interface Props {
  badge: BadgeWithEarned
  onClose: () => void
}

// Moved to lib/badgeHints; re-exported for existing importers.
export { howToEarn }

/**
 * Has the badge's event already ended? null while unknown. Only asked for
 * locked event badges, where "Up for grabs" on a past event was misleading
 * (m1 nonnative 3).
 */
function useEventEnded(eventId: string | null, enabled: boolean): boolean | null {
  const [ended, setEnded] = useState<boolean | null>(null)
  useEffect(() => {
    if (!eventId || !enabled) return
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('events')
          .select('starts_at, ends_at')
          .eq('id', eventId)
          .maybeSingle()
        if (cancelled || !data) return
        const row = data as { starts_at: string | null; ends_at: string | null }
        const end = row.ends_at ? new Date(row.ends_at) : row.starts_at ? endOfDay(new Date(row.starts_at)) : null
        if (end && !isNaN(end.getTime())) setEnded(end.getTime() < Date.now())
      } catch { /* keep the neutral wording */ }
    })()
    return () => { cancelled = true }
  }, [eventId, enabled])
  return ended
}

export default function BadgeDetailModal({ badge, onClose }: Props) {
  const isEvent = !!badge.event_id
  const rarity = badgeRarity(badge.earned_count, badge.member_count)
  const eventEnded = useEventEnded(badge.event_id, isEvent && !badge.earned)
  const how = howToEarn(badge)
  // Locked badge from a past event, or still to come / unknown.
  const eventLine = badge.earned
    ? 'Earned at'
    : eventEnded === true ? 'Was available at' : eventEnded === false ? 'Available at' : 'From'

  return (
    // The badge name is the dialog's heading (and accessible name); an empty
    // title left an empty <h2> and an unnamed dialog (m2 S18).
    <Modal title={badge.name} onClose={onClose} size="sm">
      <div className="px-6 py-8 text-center bg-cream-50">
        {/* Badge icon plate — gold frame marks event exclusives */}
        <div className={`relative mx-auto w-24 h-24 rounded-2xl flex items-center justify-center text-5xl mb-5 border-2
          ${badge.earned
            ? isEvent ? 'bg-night-800 border-gold-400 shadow-sticker-gold' : 'bg-night-800 border-night-900 shadow-sticker'
            : isEvent ? 'bg-cream-200 border-dashed border-gold-400/70 opacity-70' : 'bg-cream-200 border-night-900 grayscale opacity-60'}`}
        >
          {badge.earned ? <BadgeIcon icon={badge.icon} className="w-12 h-12" /> : '🔒'}
          {badge.earned && (
            <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-night-900 flex items-center justify-center text-xs
              ${isEvent ? 'bg-gold-300' : 'bg-sauce-400'}`}>
              {isEvent ? '★' : '✓'}
            </span>
          )}
        </div>

        <p className={`eyebrow mb-2 ${isEvent ? 'text-gold-500' : ''}`}>
          {isEvent ? 'Event exclusive' : 'Badge'}
        </p>

        {badge.earned && badge.description && (
          <p className="text-sm text-charcoal-500 mb-3 leading-relaxed max-w-[220px] mx-auto">{badge.description}</p>
        )}

        {isEvent && badge.event_name && (
          badge.event_slug ? (
            <Link
              to={`/events/${badge.event_slug}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 mb-3 text-xs font-extrabold uppercase tracking-crowd text-gold-500 hover:text-gold-600 transition-colors"
            >
              <span aria-hidden="true">★</span>
              {eventLine} {badge.event_name} →
            </Link>
          ) : (
            <p className="mb-3 text-xs font-extrabold uppercase tracking-crowd text-gold-500">
              ★ {eventLine} {badge.event_name}
            </p>
          )
        )}
        {isEvent && !badge.earned && eventEnded && (
          <p className="-mt-1 mb-3 text-xs text-charcoal-500">This event has ended.</p>
        )}

        {rarity && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-crowd ${RARITY_CHIP_CLASSES[rarity.tier]}`}>
              {rarity.label}
            </span>
            <span className="text-[11px] text-charcoal-500 font-bold">
              {rarityLine(rarity)}
            </span>
          </div>
        )}

        {badge.earned ? (
          <>
            {how && how !== badge.description && (
              <p className="text-xs text-charcoal-500 mb-3 max-w-[260px] mx-auto">
                <span className="font-bold">How to earn it:</span> {how}
              </p>
            )}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-night-800 border-2 border-night-900 shadow-sticker-sm text-cream-50 text-xs font-extrabold uppercase tracking-crowd">
              <span className="text-sauce-300">✓</span>
              Earned{badge.earned_at ? ` · ${format(new Date(badge.earned_at), 'MMM d, yyyy')}` : ''}
            </div>
          </>
        ) : (
          <div className="bg-cream-100 border-2 border-night-900/20 rounded-xl px-4 py-3 text-left">
            {/* Plain instructions first; the teaser is the fun extra. */}
            <p className="eyebrow mb-1.5">How to earn it</p>
            <p className="text-sm text-night-800 leading-relaxed">{how}</p>
            {/* Event badges' teasers are riddles about local culture ("This
                city loses its mind over one sport…") that read as nonsense
                to visitors: the plain rule above is enough (m2 S17). */}
            {!isEvent && badgeTeaser(badge) !== how && (
              <p className="text-xs text-charcoal-500 italic leading-relaxed mt-2">{badgeTeaser(badge)}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
