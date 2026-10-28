import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => {
  const tables: string[] = []
  const rows: Record<string, unknown[]> = {}
  function makeBuilder(table: string): any {
    const builder: any = {
      select: () => builder,
      order: () => builder,
      then: (resolve: any) => resolve({ data: rows[table] ?? [], error: null }),
    }
    return builder
  }
  return {
    tables,
    rows,
    from: vi.fn((table: string) => { tables.push(table); return makeBuilder(table) }),
  }
})

vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))
vi.mock('../lib/reviewActions', () => ({ createReview: vi.fn(), updateReview: vi.fn(), deleteReview: vi.fn() }))

const { useReviews, groupSpots } = await import('./useReviews')
const { useTickerSpots } = await import('./useTickerSpots')

beforeEach(() => {
  mocks.tables.length = 0
  mocks.from.mockClear()
  mocks.rows.wing_spots = [{ id: 's1', name: 'Bravo' }, { id: 's2', name: 'Alpha' }]
  mocks.rows.reviews_with_profiles = [
    { id: 'r1', wing_spot_id: 's1', overall_rating: 8, visited_at: '2026-10-02' },
    { id: 'r2', wing_spot_id: 's1', overall_rating: 6, visited_at: '2026-10-01' },
  ]
  mocks.rows.review_photos = []
})

describe('useReviews (S26: Spots/Map data waits until needed)', () => {
  it('downloads nothing while disabled, and once when enabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useReviews({ enabled }), { initialProps: { enabled: false } })
    expect(result.current.loading).toBe(true)
    expect(mocks.from).not.toHaveBeenCalled()

    rerender({ enabled: true })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.tables.sort()).toEqual(['review_photos', 'reviews_with_profiles', 'wing_spots'])
    expect(result.current.spots[0].spot.name).toBe('Bravo') // rated spots first
    expect(result.current.spots[0].avg_rating).toBe(7)

    rerender({ enabled: false })
    rerender({ enabled: true })
    expect(mocks.tables).toHaveLength(3)
  })

  it('loads straight away by default', async () => {
    const { result } = renderHook(() => useReviews())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.tables).toHaveLength(3)
  })
})

describe('useTickerSpots', () => {
  it('fetches only spots and reviews, in the shape the ticker reads', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useTickerSpots(enabled), { initialProps: { enabled: false } })
    expect(mocks.from).not.toHaveBeenCalled()
    rerender({ enabled: true })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mocks.tables.sort()).toEqual(['reviews_with_profiles', 'wing_spots'])
    expect(result.current.spots.map(s => [s.spot.name, s.reviews.length])).toEqual([['Bravo', 2], ['Alpha', 0]])
  })
})

describe('groupSpots', () => {
  it('attaches photos to their review and spot', () => {
    const spots = groupSpots(
      [{ id: 's1', name: 'A' }] as never,
      [{ id: 'r1', wing_spot_id: 's1', overall_rating: 9 }] as never,
      [{ id: 'p1', review_id: 'r1' }] as never,
    )
    expect(spots[0].reviews[0].photos).toHaveLength(1)
    expect(spots[0].photos).toHaveLength(1)
  })
})
