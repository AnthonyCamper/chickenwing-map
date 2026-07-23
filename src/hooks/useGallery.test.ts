import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { GalleryPhoto } from '../lib/types'

// Mutable mock state + a minimal chainable/thenable query builder standing in
// for the supabase-js query chain (`.select().order().range()` etc, awaited
// directly). Built inside vi.hoisted so the vi.mock factory below can safely
// reference it regardless of hoisting order.
const mocks = vi.hoisted(() => {
  const state: { rangeCalls: Array<[number, number]>; rows: unknown[] } = {
    rangeCalls: [],
    rows: [],
  }
  function makeBuilder(): any {
    const builder: any = {
      select: () => builder,
      order: () => builder,
      eq: () => builder,
      in: () => builder,
      range: (from: number, to: number) => {
        state.rangeCalls.push([from, to])
        return builder
      },
      then: (resolve: any) => resolve({ data: state.rows, error: null }),
    }
    return builder
  }
  return { state, from: vi.fn(() => makeBuilder()) }
})

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../lib/pushManager', () => ({ triggerPushDelivery: vi.fn() }))

const { useGallery, groupByReview, invalidateGalleryFeedCache } = await import('./useGallery')

function makePhoto(overrides: Partial<GalleryPhoto> = {}): GalleryPhoto {
  return {
    photo_id: 'p1',
    photo_url: 'https://example.com/p1.jpg',
    display_order: 0,
    photo_created_at: '2026-07-01T00:00:00Z',
    review_id: 'r1',
    overall_rating: 8,
    wing_flavor: 'Buffalo',
    wing_flavors: ['Buffalo'],
    review_text: null,
    visited_at: '2026-07-01',
    wing_spot_id: 's1',
    spot_name: 'Wing Spot',
    spot_slug: 'wing-spot',
    spot_address: '123 Main St',
    reviewer_id: 'u1',
    reviewer_name: 'Tony',
    reviewer_username: 'tony',
    reviewer_avatar: null,
    reviewer_email: null,
    reviewer_is_private: false,
    like_count: 0,
    comment_count: 0,
    is_liked_by_me: false,
    event_id: null,
    event_slug: null,
    event_name: null,
    ...overrides,
  }
}

describe('groupByReview', () => {
  it('groups photos by review and sorts by display_order', () => {
    const items = groupByReview([
      makePhoto({ photo_id: 'p2', display_order: 1 }),
      makePhoto({ photo_id: 'p1', display_order: 0 }),
      makePhoto({ photo_id: 'p3', review_id: 'r2' }),
    ])
    expect(items).toHaveLength(2)
    expect(items[0].photos.map(p => p.photo_id)).toEqual(['p1', 'p2'])
    expect(items[1].review_id).toBe('r2')
  })

  it('drops duplicate photo rows from overlapping pages', () => {
    const items = groupByReview([
      makePhoto({ photo_id: 'p1' }),
      makePhoto({ photo_id: 'p2', display_order: 1 }),
      // Same rows again, as if a page boundary shifted between fetches
      makePhoto({ photo_id: 'p1' }),
      makePhoto({ photo_id: 'p2', display_order: 1 }),
    ])
    expect(items).toHaveLength(1)
    expect(items[0].photos).toHaveLength(2)
    expect(items[0].photos.map(p => p.photo_id)).toEqual(['p1', 'p2'])
  })
})

describe('invalidateGalleryFeedCache', () => {
  it('is exported and callable', () => {
    expect(() => invalidateGalleryFeedCache()).not.toThrow()
  })
})

describe('useGallery depth persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mocks.state.rangeCalls = []
    mocks.state.rows = []
    invalidateGalleryFeedCache()
  })

  it('cold-mounts with a saved depth by fetching a range covering that depth', async () => {
    sessionStorage.setItem('gallery-depth:discover', '42')
    mocks.state.rows = []

    renderHook(() => useGallery('u1', false))

    await waitFor(() => expect(mocks.state.rangeCalls.length).toBeGreaterThan(0))
    expect(mocks.state.rangeCalls[0]).toEqual([0, 41])
  })

  it('persists the loaded depth to sessionStorage after a successful load', async () => {
    const rows = Array.from({ length: 21 }, (_, i) =>
      makePhoto({ photo_id: `p${i}`, review_id: `r${i}` })
    )
    mocks.state.rows = rows

    const { result } = renderHook(() => useGallery('u1', false))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(sessionStorage.getItem('gallery-depth:discover')).toBe(String(rows.length))
  })
})
