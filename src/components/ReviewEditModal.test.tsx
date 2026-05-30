import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReviewEditModal from './ReviewEditModal'
import type { Review } from '../lib/types'

vi.mock('../hooks/useBottomSheetDrag', () => ({
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
    expect(screen.getByText('Edit Review')).toBeInTheDocument()
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
})
