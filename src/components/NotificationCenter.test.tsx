import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import NotificationCenter, { notificationText } from './NotificationCenter'
import type { Notification } from '../lib/types'
import type { UseNotificationsReturn } from '../hooks/useNotifications'

const lookups: Record<string, Record<string, unknown> | null> = {}
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) q[m] = () => q
      q.maybeSingle = async () => ({ data: lookups[table] ?? null, error: null })
      return q
    },
  },
}))
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))

function notif(overrides: Partial<Notification>): Notification {
  return {
    id: 'n1', recipient_id: 'me', actor_id: 'a', type: 'comment_reply',
    review_id: null, photo_id: null, comment_id: null, crawl_id: null,
    shop_name: null, preview_text: 'Imp replied to your comment', read: false, push_sent: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname}{loc.hash}</p>
}

function renderCenter(items: Notification[]) {
  const onClose = vi.fn()
  const notifications = {
    notifications: items, loading: false, unreadCount: 1, markRead: vi.fn(), markAllRead: vi.fn(),
    loadMore: vi.fn(), hasMore: false, enablePush: vi.fn(), pushSubscribed: true, pushSupported: false,
  } as unknown as UseNotificationsReturn
  render(
    <MemoryRouter initialEntries={['/lists/my-list']}>
      <Routes>
        <Route path="*" element={<><NotificationCenter notifications={notifications} onClose={onClose} /><Where /></>} />
      </Routes>
    </MemoryRouter>
  )
  return onClose
}

describe('NotificationCenter', () => {
  beforeEach(() => { for (const k of Object.keys(lookups)) delete lookups[k] })

  it('opens the exact comment from any page (not only Home)', async () => {
    const onClose = renderCenter([notif({ review_id: 'r1', comment_id: 'c9' })])
    fireEvent.click(screen.getByText('Imp replied to your comment'))
    expect(onClose).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/reviews/r1#comment-c9'))
  })

  it('finds the review from the comment when the row has no review id', async () => {
    lookups.review_comments = { review_id: 'r7' }
    renderCenter([notif({ comment_id: 'c3' })])
    fireEvent.click(screen.getByText('Imp replied to your comment'))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/reviews/r7#comment-c3'))
  })

  it('photo-only notifications open the review of that photo', async () => {
    lookups.review_photos = { review_id: 'r5' }
    renderCenter([notif({ type: 'photo_like', photo_id: 'p1', preview_text: 'Someone liked your photo' })])
    fireEvent.click(screen.getByText('Someone liked your photo'))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/reviews/r5'))
  })
})

describe('notificationText', () => {
  const base = {
    id: 'n1', recipient_id: 'u1', actor_id: 'u2', review_id: 'r1', photo_id: null, comment_id: null,
    crawl_id: null, read: false, push_sent: false, created_at: '2026-10-28T12:00:00Z',
  }
  it('turns an emoji-only reaction preview into a plain sentence', () => {
    expect(notificationText({ ...base, type: 'review_reaction', shop_name: 'Anchor Bar', preview_text: '❤️' }))
      .toBe('New reaction on your Anchor Bar review: ❤️')
  })
  it('keeps previews that already say something', () => {
    expect(notificationText({ ...base, type: 'photo_comment', shop_name: 'Anchor Bar', preview_text: 'Ana commented: "yum"' }))
      .toBe('Ana commented: "yum"')
  })
})
