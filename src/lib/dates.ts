import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'

// `visited_at` is a calendar date (YYYY-MM-DD). `new Date('2026-10-27')`
// parses that as UTC midnight, which renders as the previous day anywhere
// west of UTC and as "about 22 hours ago" for a review posted just now.
// Parse date-only strings as local dates; pass full timestamps through.
export function parseLocalDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

// "Oct 27, 2026" — falls back to the raw string if unparseable.
export function formatVisitDate(value: string | null | undefined): string {
  const d = parseLocalDate(value)
  return d ? format(d, 'MMM d, yyyy') : (value ?? '')
}

// Relative label for a visit date: "today", "yesterday", else "3 days ago".
// A date has no time of day, so never claim hours.
export function relativeVisitDate(value: string | null | undefined): string {
  const d = parseLocalDate(value)
  if (!d) return ''
  if (isToday(d)) return 'today'
  if (isYesterday(d)) return 'yesterday'
  if (d.getTime() > Date.now()) return format(d, 'MMM d, yyyy')
  return formatDistanceToNow(d, { addSuffix: true })
}

// Today's date as YYYY-MM-DD in the user's timezone (for <input type="date">).
export function localDateString(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}
