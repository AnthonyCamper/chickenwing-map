import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReviewPhotoFan, { groupPhotosByReview } from './ReviewPhotoFan'
import type { ReviewPhoto } from '../../lib/types'

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

describe('groupPhotosByReview', () => {
  it('returns an empty array for no photos', () => {
    expect(groupPhotosByReview([])).toEqual([])
  })

  it('groups by review_id preserving first-seen review order', () => {
    const groups = groupPhotosByReview([
      photo('a1', 'rA', 0),
      photo('b1', 'rB', 0),
      photo('a2', 'rA', 1),
    ])
    expect(groups.map(g => g[0].review_id)).toEqual(['rA', 'rB'])
    expect(groups[0].map(p => p.id)).toEqual(['a1', 'a2'])
    expect(groups[1].map(p => p.id)).toEqual(['b1'])
  })

  it('sorts photos within a review by display_order', () => {
    const groups = groupPhotosByReview([
      photo('a2', 'rA', 2),
      photo('a0', 'rA', 0),
      photo('a1', 'rA', 1),
    ])
    expect(groups[0].map(p => p.id)).toEqual(['a0', 'a1', 'a2'])
  })
})

describe('ReviewPhotoFan', () => {
  it('renders a single photo with no count badge', () => {
    // NB: <img alt=""> maps to the presentation role, so query the DOM directly.
    const { container } = render(<ReviewPhotoFan photos={[photo('a1', 'rA', 0)]} onOpen={vi.fn()} />)
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View photo' })).toBeInTheDocument()
  })

  it('renders a fan with ×N badge and at most 2 photos peeking behind', () => {
    const photos = [0, 1, 2, 3, 4].map(i => photo(`a${i}`, 'rA', i))
    const { container } = render(<ReviewPhotoFan photos={photos} onOpen={vi.fn()} />)
    // front + 2 behind, never more
    expect(container.querySelectorAll('img')).toHaveLength(3)
    expect(screen.getByText('×5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View 5 photos' })).toBeInTheDocument()
  })

  it('fires onOpen when tapped', () => {
    const onOpen = vi.fn()
    render(<ReviewPhotoFan photos={[photo('a1', 'rA', 0)]} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for an empty photo list', () => {
    const { container } = render(<ReviewPhotoFan photos={[]} onOpen={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
