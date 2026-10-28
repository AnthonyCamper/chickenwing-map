import { format } from 'date-fns'

/**
 * Short relative time for tight rows (comment headers): "now", "5 min",
 * "3 hr", "2 days", then a short date ("Oct 3", or "Oct 3, 2025" in another
 * year). Units are spelled as words, not single letters ("5m" read as five
 * metres to a non-native reader), and stay short enough not to be cut off
 * next to a long name on a phone. Pair it with `fullDateTime` in a title /
 * aria-label.
 */
export function compactTimeAgo(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const ms = d.getTime()
  if (Number.isNaN(ms)) return ''
  const sec = Math.max(0, Math.floor((now.getTime() - ms) / 1000))
  if (sec < 60) return 'now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} hr`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? '1 day' : `${days} days`
  return d.getFullYear() === now.getFullYear() ? format(d, 'MMM d') : format(d, 'MMM d, yyyy')
}

/** Full date and time for the title / screen readers: "October 3, 2026 at 4:05 PM". */
export function fullDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return format(d, "MMMM d, yyyy 'at' h:mm a")
}
