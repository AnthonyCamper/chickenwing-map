import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

import { rankRows, MIN_REVIEWS_FOR_AVG_RANK } from './useLeaderboard'
import type { LeaderboardRow } from '../lib/types'

function row(user_id: string, review_count: number, avg_rating: number | null): LeaderboardRow {
  return { user_id, review_count, avg_rating } as unknown as LeaderboardRow
}

describe('rankRows', () => {
  const rows = [row('newbie', 1, 10), row('regular', 12, 8.1), row('two', 2, 9.5), row('none', 0, null)]

  it('average-rating board only ranks people with enough reviews', () => {
    expect(rankRows(rows, 'heat').map(r => r.user_id)).toEqual(['regular'])
    expect(MIN_REVIEWS_FOR_AVG_RANK).toBe(3)
  })

  it('other boards keep everyone', () => {
    expect(rankRows(rows, 'reviews').map(r => r.user_id)).toEqual(['regular', 'two', 'newbie', 'none'])
  })
})
