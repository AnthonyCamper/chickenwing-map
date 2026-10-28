import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { EVENT_COVER_CACHE_SECONDS, eventCoverPath } from './useAdminEvents'

describe('eventCoverPath', () => {
  it('gives every upload its own file name under the event slug', () => {
    const file = new File(['x'], 'poster.jpg', { type: 'image/jpeg' })
    const a = eventCoverPath('dc-crawl', file, 1_000)
    const b = eventCoverPath('dc-crawl', file, 2_000)
    expect(a).toMatch(/^dc-crawl\/cover-[0-9a-z]+\.jpg$/)
    expect(a).not.toBe(b)
  })

  it('uses the extension of the (downscaled) file', () => {
    const png = new File(['x'], 'poster.png', { type: 'image/png' })
    expect(eventCoverPath('e', png, 1)).toBe('e/cover-1.png')
  })

  it('caches covers for a year', () => {
    expect(EVENT_COVER_CACHE_SECONDS).toBe('31536000')
  })
})
