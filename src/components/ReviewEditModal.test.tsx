import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReviewEditModal from './ReviewEditModal'
import type { Review } from '../lib/types'

vi.mock('../hooks/useBottomSheetDrag', () => ({
  useIsMobile: () => false,
  useBottomSheetDrag: () => ({
    expanded: false,
    setExpanded: vi.fn(),
    handleProps: { onTouchStart: vi.fn(), onTouchMove: vi.fn(), onTouchEnd: vi.fn(), onClick: vi.fn() },
    sheetStyle: { maxHeight: '90dvh' },
  }),
}))

beforeEach(() => {
  document.body.style.cssText = ''
})

// A review shaped exactly like a row from reviews_with_profiles
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

describe('ReviewEditModal', () => {
  it('populates fields from a complete review', () => {
    render(<ReviewEditModal review={makeReview()} onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(screen.getByText('Edit your review')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Hot and crispy')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-05-01')).toBeInTheDocument()
  })

  it('does not crash when overall_rating is a numeric string (PostgREST edge)', () => {
    // supabase can hand back numeric as a string; RatingPicker calls .toFixed
    const review = makeReview({ overall_rating: '6.5' as unknown as number })
    expect(() =>
      render(<ReviewEditModal review={review} onClose={vi.fn()} onSubmit={vi.fn()} />)
    ).not.toThrow()
  })

  it('does not crash when visited_at is null (legacy rows)', () => {
    const review = makeReview({ visited_at: null as unknown as string })
    expect(() =>
      render(<ReviewEditModal review={review} onClose={vi.fn()} onSubmit={vi.fn()} />)
    ).not.toThrow()
  })

  it('does not crash when overall_rating is null', () => {
    const review = makeReview({ overall_rating: null as unknown as number })
    expect(() =>
      render(<ReviewEditModal review={review} onClose={vi.fn()} onSubmit={vi.fn()} />)
    ).not.toThrow()
  })

  it('flags a future date as soon as it is entered and focuses it on Save', async () => {
    const onSubmit = vi.fn()
    render(<ReviewEditModal review={makeReview()} onClose={vi.fn()} onSubmit={onSubmit} />)
    const date = screen.getByLabelText('Date you visited')
    fireEvent.change(date, { target: { value: '2099-12-31' } })
    expect(screen.getByText(/can't be in the future/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Check the visit date above.')).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(date))
  })

  it('keeps over-long pasted text and asks to shorten it instead of cutting it', () => {
    const onSubmit = vi.fn()
    render(<ReviewEditModal review={makeReview()} onClose={vi.fn()} onSubmit={onSubmit} />)
    const text = screen.getByLabelText('Your review (optional)')
    fireEvent.change(text, { target: { value: 'y'.repeat(510) } })
    expect(text).toHaveValue('y'.repeat(510))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/10 characters too long/)).toBeInTheDocument()
  })
})

