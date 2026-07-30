import { startOfDay, endOfDay } from 'date-fns'

export type EventPhase = 'announced' | 'route_live' | 'crawl_day' | 'wrapped'

/**
 * Derive the lifecycle phase of an event from data already on hand.
 * Never stored — computed per render so it can't go stale.
 *
 * The crawl-day window runs from the start of starts_at's local day to
 * ends_at (or the end of that same day), so early birds see the live page
 * at breakfast, not at the minute the first stop opens.
 */
export function eventPhase(
  event: { starts_at: string | null; ends_at: string | null },
  stopCount: number,
  now: Date = new Date(),
): EventPhase {
  if (!event.starts_at) return stopCount > 0 ? 'route_live' : 'announced'

  const starts = new Date(event.starts_at)
  if (isNaN(starts.getTime())) return stopCount > 0 ? 'route_live' : 'announced'

  const windowStart = startOfDay(starts)
  const parsedEnd = event.ends_at ? new Date(event.ends_at) : null
  const windowEnd = parsedEnd && !isNaN(parsedEnd.getTime()) ? parsedEnd : endOfDay(starts)

  if (now > windowEnd) return 'wrapped'
  if (now >= windowStart) return 'crawl_day'
  return stopCount > 0 ? 'route_live' : 'announced'
}
