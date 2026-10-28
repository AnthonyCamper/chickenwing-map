import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const state: { rows: unknown[]; queries: number } = { rows: [], queries: 0 }
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => {
      state.queries += 1
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'limit']) q[m] = () => q
      q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: state.rows, error: null }).then(res)
      return q
    },
  },
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

import { useFollowsAnyone, noteFollowChange, _resetFollowsAnyoneCache } from './useFollow'

describe('useFollowsAnyone (picks the default feed tab)', () => {
  beforeEach(() => { _resetFollowsAnyoneCache(); state.rows = []; state.queries = 0 })

  it('signed out → false without a query', () => {
    const { result } = renderHook(() => useFollowsAnyone(''))
    expect(result.current).toBe(false)
    expect(state.queries).toBe(0)
  })

  it('a new account that follows nobody → false (feed opens on Discover)', async () => {
    const { result } = renderHook(() => useFollowsAnyone('new-user'))
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toBe(false))
  })

  it('following someone → true, and a fresh follow is remembered without a refetch', async () => {
    state.rows = [{ following_id: 'x' }]
    const { result } = renderHook(() => useFollowsAnyone('fan'))
    await waitFor(() => expect(result.current).toBe(true))

    noteFollowChange('newbie', true)
    const before = state.queries
    const { result: r2 } = renderHook(() => useFollowsAnyone('newbie'))
    expect(r2.current).toBe(true)
    expect(state.queries).toBe(before)
  })
})
