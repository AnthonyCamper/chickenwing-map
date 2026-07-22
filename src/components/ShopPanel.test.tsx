import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShopPanel from './ShopPanel'
import type { SpotWithReviews, Review, ReviewPhoto } from '../lib/types'

vi.mock('./ReviewCard', () => ({
  default: ({ review }: { review: Review }) => <div data-testid="review-card">{review.id}</div>,
}))

function photo(id: string, review_id: string, display_order: number): ReviewPhoto {
  return {
    id,
    review_id,
    display_order,
    storage_path: `path/${id}.jpg`,
    url: `https://example.test/${id}.jpg`,
    created_at: '2026-07-01T00:00:00Z',
  }
}

function makeSpotData(reviewIds: string[], photos: ReviewPhoto[]): SpotWithReviews {
  return {
    spot: { id: 'spot1', name: 'Wing Palace', address: '123 Main St' },
    reviews: reviewIds.map(id => ({ id })),
    avg_rating: 8.2,
    photos,
  } as unknown as SpotWithReviews
}

function renderPanel(spotData: SpotWithReviews, onPhotoOpen = vi.fn()) {
  render(
    <ShopPanel
      spotData={spotData}
      onClose={vi.fn()}
      currentUserId="u1"
      isAdmin={false}
      onUpdate={vi.fn(async () => ({ error: null as string | null }))}
      onDelete={vi.fn(async () => ({ error: null as string | null }))}
      onPhotoOpen={onPhotoOpen}
    />
  )
  return { onPhotoOpen }
}

describe('ShopPanel photo strip', () => {
  it('renders one fan per review, not one thumbnail per photo', () => {
    renderPanel(makeSpotData(['rA', 'rB'], [
      photo('a1', 'rA', 0), photo('a2', 'rA', 1), photo('a3', 'rA', 2),
      photo('b1', 'rB', 0),
    ]))
    expect(screen.getByRole('button', { name: 'View 3 photos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View photo' })).toBeInTheDocument()
    expect(screen.getByText('×3')).toBeInTheDocument()
  })

  it('opens the viewer at the first photo of the tapped review', () => {
    const { onPhotoOpen } = renderPanel(makeSpotData(['rA', 'rB'], [
      photo('a2', 'rA', 1), photo('a1', 'rA', 0),
      photo('b1', 'rB', 0),
    ]))
    fireEvent.click(screen.getByRole('button', { name: 'View 2 photos' }))
    expect(onPhotoOpen).toHaveBeenCalledWith('a1')
  })
})

describe('ShopPanel review collapse', () => {
  it('hides reviews by default behind a Show button', () => {
    renderPanel(makeSpotData(['rA', 'rB'], []))
    expect(screen.queryAllByTestId('review-card')).toHaveLength(0)
    expect(screen.getByRole('button', { name: /Show 2 reviews/ })).toBeInTheDocument()
  })

  it('expands and collapses on toggle, flipping the label', () => {
    renderPanel(makeSpotData(['rA', 'rB'], []))
    fireEvent.click(screen.getByRole('button', { name: /Show 2 reviews/ }))
    expect(screen.getAllByTestId('review-card')).toHaveLength(2)
    const hide = screen.getByRole('button', { name: /Hide reviews/ })
    fireEvent.click(hide)
    expect(screen.queryAllByTestId('review-card')).toHaveLength(0)
  })

  it('uses singular label for one review', () => {
    renderPanel(makeSpotData(['rA'], []))
    expect(screen.getByRole('button', { name: /Show 1 review$/ })).toBeInTheDocument()
  })

  it('renders no toggle when the spot has no reviews', () => {
    renderPanel(makeSpotData([], []))
    expect(screen.queryByRole('button', { name: /Show/ })).not.toBeInTheDocument()
  })
})
