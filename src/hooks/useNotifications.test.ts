import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

// Counts the requests and realtime channels the hook opens.
const requests: string[] = []
const channels: string[] = []
const removed: string[] = []

function query(table: string) {
  const result = { data: [], count: 3, error: null }
  const q: Record<string, unknown> = {}
  let head = false
  q.select = (_cols: string, opts?: { head?: boolean }) => { head = !!opts?.head; return q }
  for (const m of ['eq', 'order', 'range', 'update', 'upsert']) q[m] = () => q
  q.maybeSingle = () => { requests.push(`${table}:single`); return Promise.resolve({ data: null, error: null }) }
  q.then = (res: (v: unknown) => unknown) => {
    requests.push(`${table}:${head ? 'count' : 'list'}`)
    return Promise.resolve(result).then(res)
  }
  return q
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => query(table),
    channel: (name: string) => {
      channels.push(name)
      const ch = { on: () => ch, subscribe: () => ch, name }
      return ch
    },
    removeChannel: (ch: { name: string }) => { removed.push(ch.name) },
  },
}))
vi.mock('../lib/pushManager', () => ({
  isPushSupported: () => false,
  isSubscribedToPush: () => Promise.resolve(false),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
  triggerPushDelivery: vi.fn(),
}))

import { useNotifications, _resetNotificationsStoreForTests } from './useNotifications'

describe('useNotifications', () => {
  beforeEach(() => {
    _resetNotificationsStoreForTests()
    requests.length = 0
    channels.length = 0
    removed.length = 0
  })

  it('loads once and keeps one realtime channel across page changes', async () => {
    // Page A's header mounts…
    const a = renderHook(() => useNotifications('user-1'))
    await waitFor(() => expect(a.result.current.unreadCount).toBe(3))
    expect(requests.filter(r => r === 'notifications:count')).toHaveLength(1)

    // …then the user navigates: A's header unmounts, page B's mounts.
    a.unmount()
    const b = renderHook(() => useNotifications('user-1'))
    expect(b.result.current.unreadCount).toBe(3)
    expect(b.result.current.loading).toBe(false)

    // A second header on the same page shares it too.
    const c = renderHook(() => useNotifications('user-1'))
    expect(c.result.current.unreadCount).toBe(3)

    expect(requests.filter(r => r === 'notifications:count')).toHaveLength(1)
    expect(requests.filter(r => r === 'notifications:list')).toHaveLength(1)
    expect(requests.filter(r => r === 'notification_preferences:single')).toHaveLength(1)
    expect(channels).toHaveLength(1)
    expect(removed).toHaveLength(0)
  })

  it('signed out: no requests and empty state', () => {
    const { result } = renderHook(() => useNotifications(undefined))
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.notifications).toEqual([])
    expect(requests).toHaveLength(0)
  })

  it('a different user starts fresh', async () => {
    const a = renderHook(() => useNotifications('user-1'))
    await waitFor(() => expect(a.result.current.unreadCount).toBe(3))
    a.unmount()
    const b = renderHook(() => useNotifications('user-2'))
    await waitFor(() => expect(b.result.current.unreadCount).toBe(3))
    expect(requests.filter(r => r === 'notifications:count')).toHaveLength(2)
    expect(channels).toEqual(['notifications-realtime-user-1', 'notifications-realtime-user-2'])
    expect(removed).toEqual(['notifications-realtime-user-1'])
  })
})
