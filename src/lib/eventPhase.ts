import { startOfDay, endOfDay } from 'date-fns'

export type EventPhase = 'announced' | 'route_live' | 'crawl_day' | 'wrapped'

export interface EventPhaseInput {
  starts_at: string | null
  ends_at: string | null
  /** Resolved by the DB against the event's own timezone. */
  window_opens_at?: string | null
  window_closes_at?: string | null
}

const parse = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Derive the lifecycle phase of an event from data already on hand.
 * Never stored — computed per render so it can't go stale.
 *
 * The crawl-day window runs from the start of the event's local day to
 * ends_at (or the end of that same day), so early birds see the live page
 * at breakfast, not at the minute the first stop opens.
 *
 * "The event's local day" is resolved by the database against the event's
 * own timezone and handed to us as window_opens_at/window_closes_at. We use
 * those instants verbatim, so this matches what the check-in RLS policy
 * enforces regardless of the visitor's timezone. Deriving the day from the
 * browser's clock instead opened the window early for anyone east of the
 * event — see 032_event_timezone_window.sql. The local-day fallback below
 * only applies to rows fetched without those columns.
 */
export function eventPhase(
  event: EventPhaseInput,
  stopCount: number,
  now: Date = new Date(),
): EventPhase {
  if (!event.starts_at) return stopCount > 0 ? 'route_live' : 'announced'

  const starts = new Date(event.starts_at)
  if (isNaN(starts.getTime())) return stopCount > 0 ? 'route_live' : 'announced'

  const windowStart = parse(event.window_opens_at) ?? startOfDay(starts)
  const windowEnd =
    parse(event.window_closes_at) ?? parse(event.ends_at) ?? endOfDay(starts)

  if (now > windowEnd) return 'wrapped'
  if (now >= windowStart) return 'crawl_day'
  return stopCount > 0 ? 'route_live' : 'announced'
}
