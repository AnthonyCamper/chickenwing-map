import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Records every filter applied to `follows` so we can assert nothing is sent
// with an empty user id (PostgREST answers that with a 400).
const calls: { method: string; args: unknown[] }[] = []

function chain(): Record<string, unknown> {
  const result = { data: null, count: 0, error: null }
  const q: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'match']) {
    q[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return q }
  }
  q.maybeSingle = () => Promise.resolve(result)
  q.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res)
  return q
}

vi.mock('../lib/supabase', () => ({
  supabase: { from: () => chain() },
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

import { useFollow } from './useFollow'

describe('useFollow', () => {
  beforeEach(() => { calls.length = 0 })

  it('signed out: skips the "am I following" check instead of querying with an empty id', async () => {
    const { result } = renderHook(() => useFollow('', 'target-user'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls.some(c => c.method === 'match')).toBe(false)
    for (const c of calls.filter(c => c.method === 'eq')) {
      expect(c.args[1]).not.toBe('')
    }
    expect(result.current.isFollowing).toBe(false)
  })

  it('signed in: checks the follow relationship', async () => {
    const { result } = renderHook(() => useFollow('me', 'target-user'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls).toContainEqual({ method: 'match', args: [{ follower_id: 'me', following_id: 'target-user' }] })
  })
})
