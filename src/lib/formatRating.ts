/**
 * One decimal place, rounding halves up the way people expect: an average of
 * 7.05 shows "7.1". Plain `toFixed(1)` works on the binary float (7.05 is
 * stored as 7.04999…) and shows "7.0".
 */
export function formatRating(value: number | string | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return (Math.round((n + Number.EPSILON) * 10) / 10).toFixed(1)
}
