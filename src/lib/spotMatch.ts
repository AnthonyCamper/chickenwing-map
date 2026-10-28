import { supabase } from './supabase'

/**
 * Matching a typed/picked place to a wing spot that's already on the site.
 *
 * Stored names and addresses aren't always tidy (production has
 * "Duffs famous wings " with a trailing space), so an exact `eq` match missed
 * the existing spot and a duplicate got created (m2 S03). Compare a
 * normalized form instead: trimmed, whitespace collapsed, case-insensitive.
 */
export function normalizeSpotText(s: string | null | undefined): string {
  return (s ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export interface SpotCandidate {
  id: string
  name: string
  address: string
  lat?: number | null
  lng?: number | null
  created_at?: string | null
}

export interface LatLng { lat: number; lng: number }

/**
 * Same name typed with a differently written address ("1047 Main St, Buffalo,
 * NY" vs the stored "… NY 14209") is still the same restaurant when the pins
 * are this close. Small enough that two different places on one block with
 * the same name (rare) are the only false match.
 */
export const SAME_PLACE_METERS = 150

export function metersBetween(a: LatLng, b: LatLng): number {
  const R = 6371000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function isNear(c: SpotCandidate, near: LatLng | undefined): boolean {
  if (!near || !Number.isFinite(near.lat) || !Number.isFinite(near.lng)) return false
  if (c.lat == null || c.lng == null) return false
  return metersBetween({ lat: Number(c.lat), lng: Number(c.lng) }, near) <= SAME_PLACE_METERS
}

/** Same place: same normalized name and address. */
export function isSameSpotText(
  a: { name: string; address: string },
  b: { name: string; address: string },
): boolean {
  return normalizeSpotText(a.name) === normalizeSpotText(b.name)
    && normalizeSpotText(a.address) === normalizeSpotText(b.address)
}

/**
 * The existing spot for this name + address, or null. The name must match
 * (normalized); the address must match too, or — when `near` is given — the
 * spot's pin must be within SAME_PLACE_METERS. When the site already has
 * duplicates of the same place, the oldest one wins so new reviews keep
 * landing on the original.
 */
export function pickMatchingSpot<T extends SpotCandidate>(
  candidates: readonly T[],
  name: string,
  address: string,
  near?: LatLng,
): T | null {
  const matches = candidates.filter(c =>
    isSameSpotText(c, { name, address })
    || (normalizeSpotText(c.name) === normalizeSpotText(name) && isNear(c, near)))
  if (!matches.length) return null
  return [...matches].sort(byOldest)[0]
}

/**
 * Collapse rows that are the same place (normalized name + address) into the
 * first-created one, keeping the original order otherwise. Used so pickers
 * don't show identical twins.
 */
export function dedupeSpots<T extends SpotCandidate>(spots: readonly T[]): T[] {
  const keep = new Map<string, T>()
  for (const s of spots) {
    const key = `${normalizeSpotText(s.name)}|${normalizeSpotText(s.address)}`
    const prev = keep.get(key)
    if (!prev || byOldest(s, prev) < 0) keep.set(key, s)
  }
  const kept = new Set(keep.values())
  return spots.filter(s => kept.has(s))
}

function byOldest(a: SpotCandidate, b: SpotCandidate): number {
  const ta = a.created_at ? Date.parse(a.created_at) : Infinity
  const tb = b.created_at ? Date.parse(b.created_at) : Infinity
  return (Number.isNaN(ta) ? Infinity : ta) - (Number.isNaN(tb) ? Infinity : tb)
}

/** Escape LIKE wildcards so a name is matched literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, c => `\\${c}`)
}

/**
 * Look up an existing spot by name + address, tolerant of case and stray
 * whitespace. Candidates are fetched by a case-insensitive name match padded
 * with wildcards (so trailing/leading spaces in the stored name still match),
 * then compared exactly in normalized form.
 */
export async function findExistingSpot(
  name: string,
  address: string,
  near?: LatLng,
): Promise<{ spot: SpotCandidate | null; error: { message: string; code?: string } | null }> {
  const core = name.trim().replace(/\s+/g, ' ')
  if (!core) return { spot: null, error: null }
  // Inner runs of whitespace may differ too ("Duffs  famous"): let any run match.
  const pattern = `%${core.split(' ').map(escapeLike).join('%')}%`
  const { data, error } = await supabase
    .from('wing_spots')
    .select('id, name, address, lat, lng, created_at')
    .ilike('name', pattern)
    .limit(50)
  if (error) return { spot: null, error }
  return { spot: pickMatchingSpot((data ?? []) as SpotCandidate[], name, address, near), error: null }
}
