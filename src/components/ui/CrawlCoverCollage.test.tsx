import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import CrawlCoverCollage, { collageLayout } from './CrawlCoverCollage'

const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://example.test/${i}.jpg`)

describe('CrawlCoverCollage', () => {
  it('renders exactly as many tiles as photos (no empty tiles), up to 4', () => {
    for (const n of [1, 2, 3, 4]) {
      const { container, unmount } = render(<CrawlCoverCollage photos={urls(n)} />)
      expect(container.querySelectorAll('img')).toHaveLength(n)
      expect(container.firstElementChild!.children).toHaveLength(n)
      unmount()
    }
  })

  it('caps at 4 photos and renders nothing without photos', () => {
    const { container } = render(<CrawlCoverCollage photos={urls(6)} />)
    expect(container.querySelectorAll('img')).toHaveLength(4)
    const empty = render(<CrawlCoverCollage photos={[]} />)
    expect(empty.container.firstChild).toBeNull()
  })

  it('uses a single full-width tile for one photo and a big first tile for three', () => {
    expect(collageLayout(1).grid).toBe('grid-cols-1')
    expect(collageLayout(2).grid).toBe('grid-cols-2')
    const { container } = render(<CrawlCoverCollage photos={urls(3)} />)
    expect(container.firstElementChild!.children[0].className).toContain('row-span-2')
  })
})
