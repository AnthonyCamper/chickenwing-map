import { describe, it, expect, vi } from 'vitest'
import type { Review, SpotWithReviews, WingSpot } from '../lib/types'

// ListView pulls in PhotoModal + supabase-backed hooks at module scope; the
// pure helpers under test don't need any of that, so stub the heavy imports.
vi.mock('../hooks/usePhotoDetail', () => ({
  usePhotoDetail: () => ({
    review: null,
    initialIndex: 0,
    loading: false,
    open: vi.fn(),
    close: vi.fn(),
    toggleLike: vi.fn(),
    onCommentAdded: vi.fn(),
  }),
}))
vi.mock('../hooks/useHistoryModal', () => ({ useHistoryModal: () => {} }))
vi.mock('./gallery/PhotoModal', () => ({ default: () => null }))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

import {
  averageRating,
  filterShopsByReviewer,
  filterShopsBySearch,
  haversineMiles,
  formatMiles,
} from './ListView'

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    wing_spot_id: 's1',
    user_id: 'u1',
    overall_rating: 7,
    wing_size: 'large',
    wing_flavor: null,
    wing_flavors: [],
    is_takeout: false,
    takeout_container: null,
    review_text: null,
    legacy_data: null,
    event_id: null,
    event_stop_id: null,
    event_slug: null,
    event_name: null,
    visited_at: '2026-07-01',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    reviewer_name: 'Tony',
    reviewer_username: 'tony',
    reviewer_avatar: null,
    reviewer_email: 'tony@example.com',
    reviewer_is_private: false,
    ...overrides,
  }
}

function makeSpot(overrides: Partial<WingSpot> = {}): WingSpot {
  return {
    id: 's1',
    name: 'Wing Palace',
    slug: 'wing-palace',
    address: '123 Sauce St, Buffalo, NY',
    lat: 42.8864,
    lng: -78.8784,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeShop(
  spot: Partial<WingSpot>,
  reviews: Review[],
  avg?: number,
): SpotWithReviews {
  return {
    spot: makeSpot(spot),
    reviews,
    avg_rating: avg ?? averageRating(reviews),
    photos: [],
  }
}

const SHOPS: SpotWithReviews[] = [
  makeShop(
    { id: 's1', name: 'Wing Palace', address: '123 Sauce St, Buffalo, NY' },
    [
      makeReview({ id: 'r1', user_id: 'u1', overall_rating: 3, wing_flavors: ['Lemon Pepper'] }),
      makeReview({ id: 'r2', user_id: 'u2', overall_rating: 10, wing_flavors: ['Buffalo Hot'] }),
    ],
  ),
  makeShop(
    { id: 's2', name: 'Cluck Shack', address: '9 Ranch Rd, Albany, NY' },
    [makeReview({ id: 'r3', wing_spot_id: 's2', user_id: 'u2', overall_rating: 8, wing_flavor: 'Garlic Parm', wing_flavors: [] })],
  ),
]

describe('filterShopsBySearch', () => {
  it('returns everything for an empty or whitespace query', () => {
    expect(filterShopsBySearch(SHOPS, '')).toHaveLength(2)
    expect(filterShopsBySearch(SHOPS, '   ')).toHaveLength(2)
  })

  it('matches spot name case-insensitively', () => {
    const out = filterShopsBySearch(SHOPS, 'wing pal')
    expect(out).toHaveLength(1)
    expect(out[0].spot.id).toBe('s1')
  })

  it('matches address substring', () => {
    const out = filterShopsBySearch(SHOPS, 'albany')
    expect(out).toHaveLength(1)
    expect(out[0].spot.id).toBe('s2')
  })

  it('matches flavors from the wing_flavors array', () => {
    const out = filterShopsBySearch(SHOPS, 'lemon pepper')
    expect(out).toHaveLength(1)
    expect(out[0].spot.id).toBe('s1')
  })

  it('matches the legacy wing_flavor string', () => {
    const out = filterShopsBySearch(SHOPS, 'garlic')
    expect(out).toHaveLength(1)
    expect(out[0].spot.id).toBe('s2')
  })

  it('returns empty when nothing matches', () => {
    expect(filterShopsBySearch(SHOPS, 'zzz-no-such-thing')).toHaveLength(0)
  })
})

describe('filterShopsByReviewer', () => {
  it('passes shops through untouched for "all"', () => {
    expect(filterShopsByReviewer(SHOPS, 'all')).toBe(SHOPS)
  })

  it('recomputes avg_rating from only the filtered reviews', () => {
    // Spot-wide avg for s1 is 6.5 (3 + 10), but u1 gave it a 3 —
    // the card must show 3, not the spot-wide average.
    const out = filterShopsByReviewer(SHOPS, 'u1')
    expect(out).toHaveLength(1)
    expect(out[0].spot.id).toBe('s1')
    expect(out[0].reviews).toHaveLength(1)
    expect(out[0].avg_rating).toBe(3)
  })

  it('keeps every spot the reviewer reviewed, with their own averages', () => {
    const out = filterShopsByReviewer(SHOPS, 'u2')
    expect(out.map(s => s.spot.id)).toEqual(['s1', 's2'])
    expect(out[0].avg_rating).toBe(10)
    expect(out[1].avg_rating).toBe(8)
  })

  it('drops spots the reviewer never reviewed', () => {
    const out = filterShopsByReviewer(SHOPS, 'u-nobody')
    expect(out).toHaveLength(0)
  })
})

describe('averageRating', () => {
  it('returns 0 for no reviews', () => {
    expect(averageRating([])).toBe(0)
  })

  it('averages overall_rating', () => {
    const reviews = [
      makeReview({ overall_rating: 3 }),
      makeReview({ overall_rating: 10 }),
    ]
    expect(averageRating(reviews)).toBe(6.5)
  })
})

describe('haversineMiles / formatMiles', () => {
  it('is zero for the same point', () => {
    const p = { lat: 42.8864, lng: -78.8784 }
    expect(haversineMiles(p, p)).toBe(0)
  })

  it('roughly matches NYC → LA (~2,450 mi)', () => {
    const nyc = { lat: 40.7128, lng: -74.006 }
    const la = { lat: 34.0522, lng: -118.2437 }
    const d = haversineMiles(nyc, la)
    expect(d).toBeGreaterThan(2400)
    expect(d).toBeLessThan(2500)
  })

  it('formats short distances with one decimal and long ones as whole miles', () => {
    expect(formatMiles(0.84)).toBe('0.8 mi')
    expect(formatMiles(12.4)).toBe('12 mi')
  })
})
