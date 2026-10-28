import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import LiveScene, { buildDataItems, countRatedSpots, EVERGREEN, isTooReal, MIN_REVIEWS_FOR_RANKING, ONION } from './LiveScene'
import type { Review, SpotWithReviews } from '../lib/types'

function spot(id: string, ratings: number[]): SpotWithReviews {
  const reviews = ratings.map((r, i) => ({
    id: `${id}-r${i}`,
    user_id: `u${i}`,
    overall_rating: r,
    visited_at: '2026-10-01',
    reviewer_name: `Person ${i}`,
    wing_flavor: null,
  })) as unknown as Review[]
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  return {
    spot: { id, name: `Spot ${id}`, address: '1 Main St', lat: 0, lng: 0 },
    reviews,
    avg_rating: avg,
    photos: [],
  } as unknown as SpotWithReviews
}

describe('buildDataItems', () => {
  it("doesn't let a single 10/10 review take King of the house", () => {
    const items = buildDataItems([
      spot('newbie', [10]),
      spot('established', [8, 8.5, 9]),
    ])
    const king = items.find(i => i.eyebrow === 'King of the house')
    expect(king?.body).toContain('Spot established')
    expect(king?.body).toContain('3 reviews')
  })

  it('rounds the average like the rest of the site: 7.05 shows 7.1 (m2 S12)', () => {
    const items = buildDataItems([spot('half', [7.1, 7.0, 7.05])])
    expect(items.find(i => i.eyebrow === 'King of the house')?.body).toContain('7.1/10')
  })

  it('omits King of the house when no spot has enough reviews', () => {
    const items = buildDataItems([spot('a', [10]), spot('b', [9, 9])])
    expect(MIN_REVIEWS_FOR_RANKING).toBeGreaterThan(2)
    expect(items.find(i => i.eyebrow === 'King of the house')).toBeUndefined()
  })

  it('reports rated spots only, with correct plurals', () => {
    const items = buildDataItems([spot('a', [7]), spot('empty', [])])
    const report = items.find(i => i.eyebrow === 'Scene report')
    expect(report?.body).toBe('1 spot rated · 1 review posted')
  })
})

describe('countRatedSpots', () => {
  it('ignores spots without reviews (same number as the Spots list and map)', () => {
    expect(countRatedSpots([spot('a', [7]), spot('b', []), spot('c', [5, 6])])).toBe(2)
  })
})

describe('LiveScene', () => {
  const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }))
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { vi.unstubAllGlobals(); fetchMock.mockClear() })

  it('reserves its height with a placeholder while data loads', () => {
    render(<LiveScene spots={[]} loading />)
    expect(screen.getByText('Loading headlines…')).toBeInTheDocument()
  })

  it('never requests reddit.com', async () => {
    render(<LiveScene spots={[spot('a', [7])]} loading={false} />)
    await waitFor(() => expect(screen.queryByText('Loading headlines…')).not.toBeInTheDocument())
    for (const call of fetchMock.mock.calls as unknown[][]) {
      expect(String(call[0])).not.toContain('reddit.com')
    }
  })
})

describe('ticker reads as parody, not real news (Q39)', () => {
  it('has no hospital / death / police / insult headlines in the fixed lists', () => {
    const offenders = [...ONION, ...EVERGREEN].filter(it => isTooReal(it.body) || isTooReal(it.eyebrow))
    expect(offenders.map(o => o.body)).toEqual([])
  })

  it('never labels a joke "Breaking", "Health", "Alert" or "RIP"', () => {
    const labels = new Set([...ONION, ...EVERGREEN].map(it => it.eyebrow.toLowerCase()))
    for (const bad of ['breaking', 'health', 'alert', 'rip', 'developing']) expect(labels.has(bad)).toBe(false)
  })

  it('filters scary-real generated headlines', () => {
    expect(isTooReal('ER Reports Spike In Ghost Pepper Wing Incidents')).toBe(true)
    expect(isTooReal('Someone rated a spot 3/10. Investigators are on the scene.')).toBe(true)
    expect(isTooReal('HOT TAKE: The bone is not the problem. You are the problem.')).toBe(true)
    expect(isTooReal('Area Man Insists He "Only Wanted A Few" Before Finishing 30 Wings Alone')).toBe(false)
  })

  it('does not tag the ticker or its headlines as jokes', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      render(<LiveScene spots={[]} loading />)
      expect(screen.queryByText(/jokes?\b/i)).toBeNull()
      expect(screen.queryByText(/^wing news/i)).toBeNull()
      expect(screen.queryByText(/^live$/i)).toBeNull()
      const labels = [...ONION, ...EVERGREEN].map(it => it.eyebrow.toLowerCase())
      expect(labels.filter(l => /fake|parody|made-up|joke/.test(l))).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
