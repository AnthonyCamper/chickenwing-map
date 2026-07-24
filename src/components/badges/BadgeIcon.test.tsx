import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BadgeIcon from './BadgeIcon'

describe('BadgeIcon', () => {
  it('renders a custom SVG for a known registry key', () => {
    render(<BadgeIcon icon="puck" className="w-7 h-7" />)
    expect(screen.getByTestId('badge-icon-puck')).toBeInTheDocument()
  })

  it('renders every Ottawa crawl icon key as an SVG', () => {
    const keys = [
      'north-star', 'canoe', 'puck', 'beavertail', 'double-double',
      'hat-trick', 'portage', 'peace-tower', 'hansard', 'skate',
      'shield-1867', 'firework', 'skateway', 'jersey-99', 'loon-coin',
      'toonie', 'poutine', 'letter-u', 'speech-heart', 'sap-pail',
      'crossed-sticks', 'donut', 'garlic-honey', 'banner-11', 'two-four',
      'jets', 'snowflake',
    ]
    for (const key of keys) {
      const { unmount } = render(<BadgeIcon icon={key} />)
      expect(screen.getByTestId(`badge-icon-${key}`)).toBeInTheDocument()
      unmount()
    }
  })

  it('falls back to rendering the raw string for legacy emoji badges', () => {
    render(<BadgeIcon icon="🍗" />)
    expect(screen.getByText('🍗')).toBeInTheDocument()
  })
})
