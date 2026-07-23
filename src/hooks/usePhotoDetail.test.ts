import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const single = vi.fn()
const order = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((col: string) => col === 'photo_id' ? { single } : { order }),
      })),
      insert: vi.fn(async () => ({ error: null })),
      delete: vi.fn(() => ({ match: vi.fn(async () => ({ error: null })) })),
    })),
  },
}))
vi.mock('../lib/pushManager', () => ({ triggerPushDelivery: vi.fn() }))

import { usePhotoDetail } from './usePhotoDetail'

function row(photo_id: string, display_order: number) {
  return {
    photo_id, display_order,
    photo_url: `https://x/${photo_id}.jpg`, photo_created_at: '2026-07-01',
    review_id: 'r1', overall_rating: 8, wing_flavor: null, wing_flavors: [],
    review_text: null, visited_at: '2026-07-01', wing_spot_id: 's1',
    spot_name: 'Spot', spot_slug: null, spot_address: 'Addr',
    reviewer_id: 'u2', reviewer_name: 'Ana', reviewer_username: 'ana',
    reviewer_avatar: null, reviewer_email: null, reviewer_is_private: false,
    like_count: 0, comment_count: 0, is_liked_by_me: false,
    event_id: null, event_slug: null, event_name: null,
  }
}

beforeEach(() => {
  single.mockReset()
  order.mockReset()
})

describe('usePhotoDetail', () => {
  it('opens the full review with photos ordered and initialIndex at the tapped photo', async () => {
    single.mockResolvedValue({ data: row('p2', 1), error: null })
    order.mockResolvedValue({ data: [row('p1', 0), row('p2', 1), row('p3', 2)], error: null })
    const { result } = renderHook(() => usePhotoDetail('u1'))
    await act(() => result.current.open('p2'))
    await waitFor(() => expect(result.current.review).not.toBeNull())
    expect(result.current.review!.photos.map(p => p.photo_id)).toEqual(['p1', 'p2', 'p3'])
    expect(result.current.initialIndex).toBe(1)
  })

  it('falls back to a single-photo review when the review query fails', async () => {
    single.mockResolvedValue({ data: row('p2', 1), error: null })
    order.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => usePhotoDetail('u1'))
    await act(() => result.current.open('p2'))
    await waitFor(() => expect(result.current.review).not.toBeNull())
    expect(result.current.review!.photos.map(p => p.photo_id)).toEqual(['p2'])
    expect(result.current.initialIndex).toBe(0)
  })

  it('clears state and reports nothing on first-query failure', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'nope' } })
    const { result } = renderHook(() => usePhotoDetail('u1'))
    await act(() => result.current.open('p9'))
    expect(result.current.review).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
