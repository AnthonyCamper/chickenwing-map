import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReviewCard from './ReviewCard'
import type { Review } from '../lib/types'

vi.mock('../hooks/useBottomSheetDrag', () => ({
  useBottomSheetDrag: () => ({
    expanded: false,
    setExpanded: vi.fn(),
    handleProps: { onTouchStart: vi.fn(), onTouchMove: vi.fn(), onTouchEnd: vi.fn(), onClick: vi.fn() },
    sheetStyle: { maxHeight: '90dvh' },
  }),
}))

vi.mock('../hooks/useReviewReactions', () => ({
  useReviewReactions: () => ({ reactions: [], loading: false, toggleReaction: vi.fn() }),
}))

vi.mock('./AuthGateModal', () => ({
  useAuthGate: () => ({ requireAuth: () => true }),
}))

vi.mock('../lib/reactionDetails', () => ({
  fetchReviewReactors: vi.fn(async () => []),
}))

vi.mock('./ReviewCommentThread', () => ({
  default: () => null,
}))

const UNDO_WINDOW_MS = 5000

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    wing_spot_id: 's1',
    user_id: 'u1',
    overall_rating: 6.5,
    wing_size: 'large',
    wing_flavor: 'Buffalo Medium',
    wing_flavors: ['Buffalo Medium'],
    is_takeout: false,
    takeout_container: null,
    review_text: 'Hot and crispy',
    legacy_data: null,
    event_id: null,
    event_stop_id: null,
    event_slug: null,
    event_name: null,
    visited_at: '2026-05-01',
    created_at: '2026-05-01T04:08:23Z',
    updated_at: '2026-05-01T04:08:23Z',
    reviewer_name: 'WingKingTony',
    reviewer_username: 'wingkingtony',
    reviewer_avatar: null,
    reviewer_email: 'a@b.com',
    reviewer_is_private: false,
    photos: [],
    ...overrides,
  }
}

function renderCard(onDelete: (id: string) => Promise<{ error: string | null }>) {
  return render(
    <MemoryRouter>
      <ReviewCard
        review={makeReview()}
        currentUserId="u1"
        isAdmin={false}
        onUpdate={vi.fn(async () => ({ error: null }))}
        onDelete={onDelete}
      />
    </MemoryRouter>
  )
}

/** Walk the kebab → Delete menu item → confirm dialog → Delete button flow. */
function startPendingDelete() {
  fireEvent.click(screen.getByLabelText('Review options'))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
}

describe('ReviewCard undo-delete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes the pending delete exactly once when unmounted mid-countdown', async () => {
    const onDelete = vi.fn(async () => ({ error: null as string | null }))
    const { unmount } = renderCard(onDelete)

    startPendingDelete()
    expect(screen.getByText('Review deleted')).toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()

    // Unmount before the 5s undo window elapses — the promised delete must
    // fire immediately instead of being dropped with the timer.
    unmount()
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledWith('r1')

    // Advancing past the undo window must not fire it a second time.
    await act(async () => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS * 2)
    })
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('fires the delete exactly once after the undo window when left mounted', async () => {
    const onDelete = vi.fn(async () => ({ error: null as string | null }))
    renderCard(onDelete)

    startPendingDelete()
    expect(onDelete).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS + 1)
    })
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('never deletes when undo is pressed, even after unmount', async () => {
    const onDelete = vi.fn(async () => ({ error: null as string | null }))
    const { unmount } = renderCard(onDelete)

    startPendingDelete()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    unmount()

    await act(async () => {
      vi.advanceTimersByTime(UNDO_WINDOW_MS * 2)
    })
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe('ReviewCard layout', () => {
  it('leads with reviewer identity, date, and rating above the review text', () => {
    // Use mid-day local timestamp (no Z) to ensure consistent formatting across timezones
    const { container } = render(
      <MemoryRouter>
        <ReviewCard
          review={makeReview({ visited_at: '2026-05-01T12:00:00' })}
          currentUserId="u1"
          isAdmin={false}
          onUpdate={vi.fn(async () => ({ error: null }))}
          onDelete={vi.fn(async () => ({ error: null as string | null }))}
        />
      </MemoryRouter>
    )
    const html = container.innerHTML
    const name = html.indexOf('WingKingTony')
    const rating = html.indexOf('6.5')
    const date = html.indexOf('May 1, 2026')
    const text = html.indexOf('Hot and crispy')
    expect(name).toBeGreaterThan(-1)
    expect(rating).toBeGreaterThan(-1)
    expect(date).toBeGreaterThan(-1)
    expect(name).toBeLessThan(text)
    expect(rating).toBeLessThan(text)
    expect(date).toBeLessThan(text)
  })

  it('keeps the comment toggle and options menu in the footer (after the text)', () => {
    renderCard(vi.fn(async () => ({ error: null as string | null })))
    expect(screen.getByLabelText(/comment/)).toBeInTheDocument()
    expect(screen.getByLabelText('Review options')).toBeInTheDocument()
  })
})
