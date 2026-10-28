import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const db = vi.hoisted(() => ({ rows: [] as Array<{ id: string; earned: boolean }> }))

vi.mock('./supabase', () => {
  const builder = () => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order']) b[m] = () => b
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: db.rows, error: null }).then(resolve)
    return b
  }
  return { supabase: { from: () => builder() } }
})

import { BADGES_UNLOCKED_EVENT, announceNewBadges, holdBadgeAnnouncements, type BadgesUnlockedDetail } from './badgeUnlocks'

let events: BadgesUnlockedDetail[] = []
const listener = (e: Event) => events.push((e as CustomEvent<BadgesUnlockedDetail>).detail)

beforeEach(() => {
  events = []
  db.rows = [{ id: 'old', earned: true }, { id: 'new', earned: true }, { id: 'locked', earned: false }]
  window.addEventListener(BADGES_UNLOCKED_EVENT, listener)
})
afterEach(() => {
  window.removeEventListener(BADGES_UNLOCKED_EVENT, listener)
})

describe('badge announcements', () => {
  it('announces only badges that are new since the snapshot', async () => {
    await announceNewBadges(new Set(['old']))
    expect(events).toHaveLength(1)
    expect(events[0].badges.map(b => b.id)).toEqual(['new'])
    expect(events[0].reviewPublished).toBeUndefined()
  })

  it('holds unlocks until released, then tags them as coming from a published review', async () => {
    const release = holdBadgeAnnouncements()
    await announceNewBadges(new Set(['old']))
    expect(events).toHaveLength(0)
    release({ reviewPublished: true })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ reviewPublished: true })
    expect(events[0].badges.map(b => b.id)).toEqual(['new'])
  })

  it('an unlock found after the release still shows, with the same tag', async () => {
    const release = holdBadgeAnnouncements()
    const pending = announceNewBadges(new Set(['old'])) // diff in flight
    release({ reviewPublished: true })
    await pending
    expect(events).toHaveLength(1)
    expect(events[0].reviewPublished).toBe(true)
  })

  it('releasing with nothing queued announces nothing', () => {
    const release = holdBadgeAnnouncements()
    release()
    release() // idempotent
    expect(events).toHaveLength(0)
  })
})
