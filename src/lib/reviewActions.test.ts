import { describe, it, expect, vi, beforeEach } from 'vitest'

// A tiny fake of the supabase query builder: records every call and answers
// from `db`.
type Call = { table: string; ops: Array<[string, unknown[]]> }
const db = vi.hoisted(() => ({
  spots: [] as Array<{ id: string; name: string; address: string; created_at: string }>,
  calls: [] as Call[],
  insertedSpot: null as null | Record<string, unknown>,
  insertedReview: null as null | Record<string, unknown>,
}))

vi.mock('./supabase', () => {
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    db.calls.push(call)
    const b: Record<string, unknown> = {}
    const chain = (name: string) => (...args: unknown[]) => { call.ops.push([name, args]); return b }
    for (const m of ['select', 'eq', 'ilike', 'limit', 'order']) b[m] = chain(m)
    b.insert = (row: Record<string, unknown>) => {
      call.ops.push(['insert', [row]])
      if (table === 'wing_spots') db.insertedSpot = row
      if (table === 'reviews') db.insertedReview = row
      return b
    }
    const result = () => {
      const op = (n: string) => call.ops.find(o => o[0] === n)
      if (table === 'wing_spots' && op('insert')) return { data: { id: 'created-spot' }, error: null }
      if (table === 'reviews' && op('insert')) return { data: { id: 'review-1' }, error: null }
      if (table === 'wing_spots' && op('eq')) {
        const id = op('eq')![1][1]
        return { data: db.spots.find(s => s.id === id) ?? null, error: null }
      }
      if (table === 'wing_spots' && op('ilike')) {
        // Like Postgres ILIKE with %…% around the words.
        const pattern = String(op('ilike')![1][1])
        const words = pattern.split('%').filter(Boolean).map(w => w.toLowerCase())
        return { data: db.spots.filter(s => words.every(w => s.name.toLowerCase().includes(w))), error: null }
      }
      return { data: null, error: null }
    }
    b.maybeSingle = () => Promise.resolve(result())
    b.single = () => Promise.resolve(result())
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej)
    return b
  }
  return { supabase: { from, auth: { getSession: async () => ({ data: { session: {} }, error: null }) } } }
})
vi.mock('./badgeUnlocks', () => ({ snapshotEarnedBadgeIds: async () => new Set(), announceNewBadges: async () => {} }))
vi.mock('./pushManager', () => ({ triggerPushDelivery: () => {} }))
vi.mock('../hooks/useGallery', () => ({ invalidateGalleryFeedCache: () => {} }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))

import { createReview, type ReviewCreateData } from './reviewActions'

const ADDR = '3090 Orchard Park Rd, West Seneca, NY 14224'
const ORIGINAL_ID = '955fab5d-e516-4e6c-8426-a5663d20b640'

const form = (over: Partial<ReviewCreateData> = {}): ReviewCreateData => ({
  shop_name: 'Duffs famous wings',
  address: ADDR,
  lat: '42.8',
  lng: '-78.8',
  overall_rating: 8,
  is_takeout: false,
  visited_at: '2026-10-28',
  ...over,
})

beforeEach(() => {
  db.spots = [{ id: ORIGINAL_ID, name: 'Duffs famous wings ', address: ADDR, created_at: '2024-12-22T02:23:17Z' }]
  db.calls = []
  db.insertedSpot = null
  db.insertedReview = null
})

describe('createReview: which spot the review goes to', () => {
  it('uses the picked spot id directly, with no name lookup (m2 S03)', async () => {
    const res = await createReview(form({ wing_spot_id: ORIGINAL_ID }), 'u1')
    expect(res).toEqual({ error: null, reviewId: 'review-1' })
    expect(db.insertedReview?.wing_spot_id).toBe(ORIGINAL_ID)
    expect(db.insertedSpot).toBeNull()
    const lookups = db.calls.filter(c => c.table === 'wing_spots' && c.ops.some(o => o[0] === 'ilike'))
    expect(lookups).toHaveLength(0)
  })

  it('finds an existing spot whose stored name has a trailing space', async () => {
    await createReview(form(), 'u1')
    expect(db.insertedReview?.wing_spot_id).toBe(ORIGINAL_ID)
    expect(db.insertedSpot).toBeNull()
  })

  it('matches case-insensitively', async () => {
    await createReview(form({ shop_name: 'DUFFS Famous Wings', address: ADDR.toUpperCase() }), 'u1')
    expect(db.insertedReview?.wing_spot_id).toBe(ORIGINAL_ID)
  })

  it('creates a new spot for a brand-new place', async () => {
    await createReview(form({ shop_name: 'Brand New Wings', address: '1 Main St' }), 'u1')
    expect(db.insertedSpot).toMatchObject({ name: 'Brand New Wings', address: '1 Main St' })
    expect(db.insertedReview?.wing_spot_id).toBe('created-spot')
  })

  it('falls back to the lookup when the picked spot no longer exists', async () => {
    await createReview(form({ wing_spot_id: '00000000-0000-4000-8000-000000000000' }), 'u1')
    expect(db.insertedReview?.wing_spot_id).toBe(ORIGINAL_ID)
  })
})
