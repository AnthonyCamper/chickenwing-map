import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { localDateString } from '../../lib/dates'
import { isUuid } from '../../lib/reviewActions'
import ReviewFeedCard from './ReviewFeedCard'
import type { GalleryReviewItem } from '../../lib/types'

vi.mock('../UserProfileContext', () => ({ useUserProfile: () => ({ openProfile: vi.fn() }) }))
vi.mock('../../lib/reactionDetails', () => ({ fetchReviewLikers: vi.fn(async () => []) }))
vi.mock('../ReviewCommentThread', () => ({ default: () => null }))

function makeItem(overrides: Partial<GalleryReviewItem> = {}): GalleryReviewItem {
  return {
    review_id: 'r1',
    overall_rating: 8,
    wing_flavor: 'Buffalo Medium',
    wing_flavors: ['Buffalo Medium'],
    review_text: 'Crispy',
    visited_at: localDateString(),
    wing_spot_id: 's1',
    spot_name: 'Pubwells',
    spot_slug: 'pubwells',
    spot_address: '431 Sussex Dr',
    reviewer_id: 'u1',
    reviewer_name: 'Mo Bile',
    reviewer_username: 'mo-bile',
    reviewer_avatar: null,
    reviewer_email: null,
    reviewer_is_private: false,
    like_count: 0,
    comment_count: 0,
    is_liked_by_me: false,
    event_id: null,
    event_slug: null,
    event_name: null,
    photos: [{ photo_id: 'p1', photo_url: 'https://example.com/a.jpg', display_order: 0, photo_created_at: '2026-10-27T22:00:00Z' }],
    ...overrides,
  }
}

function renderCard(item: GalleryReviewItem, onOpen = vi.fn()) {
  render(
    <MemoryRouter>
      <ReviewFeedCard review={item} currentUserId="u1" isAdmin={false} onOpen={onOpen} onLike={vi.fn()} />
    </MemoryRouter>
  )
  return onOpen
}

describe('ReviewFeedCard', () => {
  it('says "visited today" for a review dated today, never "hours ago"', () => {
    renderCard(makeItem())
    expect(screen.getByText(/visited today/)).toBeInTheDocument()
    expect(screen.queryByText(/hours ago/)).not.toBeInTheDocument()
  })

  it('makes the event badge a real link that does not open the review', () => {
    const onOpen = renderCard(makeItem({ event_id: 'e1', event_slug: 'ottawa-crawl', event_name: 'Ottawa Crawl' }))
    const link = screen.getByRole('link', { name: /Ottawa Crawl/ })
    expect(link).toHaveAttribute('href', '/events/ottawa-crawl')
    fireEvent.click(link)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('gives like / comment / share visible text labels', () => {
    renderCard(makeItem())
    expect(screen.getByRole('button', { name: /^Like/ })).toHaveTextContent('Like')
    expect(screen.getByRole('button', { name: /^Comment/ })).toHaveTextContent('Comment')
    expect(screen.getByRole('button', { name: /^Share/ })).toHaveTextContent('Share')
  })

  it('shows a whole-number rating with one decimal, like the review page ("8.0", not "8")', () => {
    renderCard(makeItem({ overall_rating: 8 }))
    expect(screen.getByRole('button', { name: 'Rating: 8.0/10' })).toHaveTextContent('8.0')
  })

  it('gives multi-photo dots a 44px tap area', () => {
    renderCard(makeItem({ photos: [
      { photo_id: 'p1', photo_url: 'https://example.com/a.jpg', display_order: 0, photo_created_at: '2026-10-27T22:00:00Z' },
      { photo_id: 'p2', photo_url: 'https://example.com/b.jpg', display_order: 1, photo_created_at: '2026-10-27T22:00:00Z' },
    ] }))
    expect(screen.getByRole('button', { name: 'Photo 2' })).toHaveClass('w-11', 'h-11')
  })
})

describe('ReviewFeedCard copy and photos', () => {
  it('pluralises counts ("2 comments", "1 like")', () => {
    renderCard(makeItem({ comment_count: 2, like_count: 1 }))
    expect(screen.getByRole('button', { name: '2 comments' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Like/ })).toHaveTextContent('1 like')
  })

  it('describes the photo in its alt text', () => {
    renderCard(makeItem())
    expect(screen.getByAltText("Photo of wings at Pubwells, from Mo Bile's review")).toBeInTheDocument()
  })

  it('a missing photo collapses to a one-line note, not a full-height frame', () => {
    renderCard(makeItem({ photos: [{ photo_id: 'p1', photo_url: 'data:image/svg+xml;base64,AAAA', display_order: 0, photo_created_at: '2026-10-27T22:00:00Z' }] }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Photo unavailable')).toBeInTheDocument()
  })

  it('a photo that fails to load is dropped the same way', () => {
    renderCard(makeItem())
    fireEvent.error(screen.getByAltText(/Photo of wings/))
    expect(screen.getByText('Photo unavailable')).toBeInTheDocument()
  })

  it('gives the name and spot links 44px tall tap targets', () => {
    renderCard(makeItem())
    expect(screen.getByRole('button', { name: 'Mo Bile' })).toHaveClass('min-h-[44px]')
    expect(screen.getByRole('link', { name: 'Pubwells' })).toHaveClass('min-h-[44px]')
  })
})

describe('isUuid (review permalink guard)', () => {
  it('rejects junk ids so /reviews/not-a-uuid shows the 404', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('b4f9cc6a-1234-4abc-9def-0123456789ab')).toBe(true)
  })
})
