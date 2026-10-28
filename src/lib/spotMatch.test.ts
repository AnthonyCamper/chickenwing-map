import { describe, it, expect } from 'vitest'
import { dedupeSpots, escapeLike, isSameSpotText, normalizeSpotText, pickMatchingSpot } from './spotMatch'
import { dedupeOsmSuggestions, type Suggestion } from '../components/ui/BusinessAutocomplete'

const ADDR = '3090 Orchard Park Rd, West Seneca, NY 14224'
const original = { id: 'old', name: 'Duffs famous wings ', address: ADDR, created_at: '2024-12-22T02:23:17Z' }
const twin = { id: 'new', name: 'Duffs famous wings', address: ADDR, created_at: '2026-10-28T05:51:26Z' }

describe('normalizeSpotText', () => {
  it('ignores case, surrounding and repeated whitespace', () => {
    expect(normalizeSpotText('  Duffs   Famous wings ')).toBe('duffs famous wings')
    expect(normalizeSpotText(null)).toBe('')
  })
})

describe('isSameSpotText / pickMatchingSpot', () => {
  it('matches a stored name with a trailing space (m2 S03)', () => {
    expect(isSameSpotText(original, { name: 'Duffs famous wings', address: ADDR })).toBe(true)
    expect(pickMatchingSpot([original], 'Duffs famous wings', ADDR)?.id).toBe('old')
  })

  it('is case-insensitive for name and address', () => {
    expect(pickMatchingSpot([original], 'DUFFS FAMOUS WINGS', ADDR.toLowerCase())?.id).toBe('old')
  })

  it('needs the address to match too', () => {
    expect(pickMatchingSpot([original], 'Duffs famous wings', '1 Other St')).toBeNull()
  })

  it('does not match a different name that merely contains it', () => {
    expect(pickMatchingSpot([{ ...original, name: 'Duffs famous wings 2' }], 'Duffs famous wings', ADDR)).toBeNull()
  })

  it('prefers the oldest when the place is already stored twice', () => {
    expect(pickMatchingSpot([twin, original], 'Duffs famous wings', ADDR)?.id).toBe('old')
  })
})

describe('dedupeSpots', () => {
  it('collapses twins of the same place into the original, keeping order', () => {
    const other = { id: 'x', name: 'Duff Beer Wings', address: '1 Main St', created_at: '2025-01-01T00:00:00Z' }
    expect(dedupeSpots([twin, other, original]).map(s => s.id)).toEqual(['x', 'old'])
  })

  it('keeps same-name spots at different addresses', () => {
    const elsewhere = { ...twin, id: 'e', address: '1 Elsewhere Rd' }
    expect(dedupeSpots([original, elsewhere]).map(s => s.id)).toEqual(['old', 'e'])
  })
})

describe('escapeLike', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_wings\\')).toBe('100\\%\\_wings\\\\')
  })
})

describe('dedupeOsmSuggestions (m2 S13)', () => {
  const s = (over: Partial<Suggestion & { osmId?: string }>): Suggestion & { osmId?: string } => ({
    name: 'Beckys Creek Wildlife Management Area',
    address: 'West Virginia',
    lat: '38.7',
    lng: '-80.1',
    key: `osm-${Math.random()}`,
    source: 'osm',
    ...over,
  })

  it('drops a result with the same OSM id', () => {
    expect(dedupeOsmSuggestions([s({ osmId: 'way/1' }), s({ osmId: 'way/1', lat: '40', address: 'x' })])).toHaveLength(1)
  })

  it('drops the same name at the same address', () => {
    expect(dedupeOsmSuggestions([s({ osmId: 'way/1' }), s({ osmId: 'relation/2', lat: '38.9' })])).toHaveLength(1)
  })

  it('drops the same name a few metres away', () => {
    expect(dedupeOsmSuggestions([s({ address: 'A' }), s({ address: 'B', lat: '38.7005' })])).toHaveLength(1)
  })

  it('keeps branches of a chain at different places', () => {
    const out = dedupeOsmSuggestions([
      s({ name: 'Wingstop', address: '1 A St', lat: '40', lng: '-75' }),
      s({ name: 'Wingstop', address: '9 B Ave', lat: '40.1', lng: '-75.2' }),
    ])
    expect(out).toHaveLength(2)
  })
})
