import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const tables: string[] = []
const rows = [
  { user_id: 'u1', display_name: 'Ann', avatar_url: null, review_count: 1, badge_count: 1, unique_spots: 1 },
]

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      tables.push(table)
      const result = { data: table === 'leaderboard_stats' ? rows : [], error: null }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order']) q[m] = () => q
      q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
      return q
    },
  },
}))
vi.mock('../UserProfileContext', () => ({ useUserProfile: () => ({ openProfile: vi.fn() }) }))

import PeopleView from './PeopleView'

describe('PeopleView', () => {
  beforeEach(() => { tables.length = 0 })

  it('signed out: does not query follows (no user id to query with)', async () => {
    render(<PeopleView currentUserId="" />)
    await screen.findByText('Ann')
    expect(tables).toContain('leaderboard_stats')
    expect(tables).not.toContain('follows')
  })

  it('uses singular nouns for counts of one', async () => {
    render(<PeopleView currentUserId="" />)
    expect(await screen.findByText('1 review · 1 spot · 1 badge')).toBeInTheDocument()
  })
})
