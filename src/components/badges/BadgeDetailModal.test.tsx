import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const db = vi.hoisted(() => ({ event: null as null | { starts_at: string | null; ends_at: string | null } }))

vi.mock('../../lib/supabase', () => {
  const builder = () => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: db.event, error: null })
    return b
  }
  return { supabase: { from: () => builder() } }
})

vi.mock('../../hooks/useBottomSheetDrag', () => ({
  useIsMobile: () => false,
  useBottomSheetDrag: () => ({
    expanded: false,
    setExpanded: vi.fn(),
    handleProps: { onTouchStart: vi.fn(), onTouchMove: vi.fn(), onTouchEnd: vi.fn(), onClick: vi.fn() },
    sheetStyle: { maxHeight: '90dvh' },
  }),
}))

import BadgeDetailModal from './BadgeDetailModal'
import { howToEarn } from '../../lib/badgeHints'
import type { BadgeWithEarned } from '../../lib/types'

function makeBadge(overrides: Partial<BadgeWithEarned> = {}): BadgeWithEarned {
  return {
    id: 'b1',
    slug: 'canadiana-rink-rat',
    name: 'Rink Rat',
    description: 'Brought hockey into a wing review. As is right.',
    icon: '🏒',
    color: 'amber',
    criteria_type: 'review_text_contains',
    criteria_config: { hint: 'Mention hockey (or the Sens) in a crawl review.' },
    event_id: 'e1',
    event_name: '2026 Chicken Wing Crawl Ottawa',
    event_slug: '2026-chicken-wing-crawl-ottawa',
    sort_order: 1,
    earned: false,
    earned_at: null,
    ...overrides,
  }
}

const renderModal = (badge: BadgeWithEarned) =>
  render(<MemoryRouter><BadgeDetailModal badge={badge} onClose={vi.fn()} /></MemoryRouter>)

beforeEach(() => {
  document.body.style.cssText = ''
  db.event = null
})

describe('BadgeDetailModal', () => {
  it('a locked event badge says plainly how to earn it, without the riddle teaser', () => {
    renderModal(makeBadge())
    expect(screen.getByText('How to earn it')).toBeInTheDocument()
    expect(screen.getByText('Mention hockey (or the Ottawa Senators, "the Sens") in a review during the event.')).toBeInTheDocument()
    expect(screen.queryByText(/loses its mind over one sport/)).not.toBeInTheDocument()
  })

  it('a locked regular badge keeps its teaser as an extra under the plain rule', () => {
    renderModal(makeBadge({
      slug: 'decimal-daredevil', name: 'Decimal Daredevil', event_id: null, event_name: null,
      criteria_type: 'rating_uses_decimals', criteria_config: {},
    }))
    expect(screen.getByText(/Use a decimal rating at least once/)).toBeInTheDocument()
    expect(screen.getByText(/Whole numbers are for cowards/)).toBeInTheDocument()
  })

  it('the dialog is named by the badge (no empty heading)', () => {
    renderModal(makeBadge())
    expect(screen.getByRole('dialog', { name: 'Rink Rat' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading').every(h => h.textContent?.trim())).toBe(true)
  })

  it('a past event badge says it was available there, never "Up for grabs"', async () => {
    db.event = { starts_at: '2026-08-08T14:00:00Z', ends_at: '2026-08-09T03:00:00Z' }
    renderModal(makeBadge())
    expect(await screen.findByText(/Was available at/)).toBeInTheDocument()
    expect(screen.getByText('This event has ended.')).toBeInTheDocument()
    expect(screen.queryByText(/Up for grabs/i)).not.toBeInTheDocument()
  })

  it('an upcoming event badge says where it is available', async () => {
    db.event = { starts_at: '2099-08-08T14:00:00Z', ends_at: null }
    renderModal(makeBadge())
    expect(await screen.findByText(/^Available at/)).toBeInTheDocument()
    expect(screen.queryByText('This event has ended.')).not.toBeInTheDocument()
  })

  it('an earned badge with a jokey description also shows the plain rule', () => {
    renderModal(makeBadge({
      slug: 'decimal-daredevil', name: 'Decimal Daredevil', event_id: null, event_name: null,
      criteria_type: 'rating_uses_decimals', criteria_config: {},
      description: 'Used a decimal rating at least once. A true precision instrument.',
      earned: true, earned_at: '2026-10-01T00:00:00Z',
    }))
    expect(screen.getByText(/Use a decimal rating at least once/)).toBeInTheDocument()
  })
})

describe('howToEarn', () => {
  it('has plain sentences for list ("crawl") and rating-run badges', () => {
    const b = (criteria_type: string, criteria_config: Record<string, unknown>, slug = 'x') =>
      howToEarn(makeBadge({ criteria_type: criteria_type as BadgeWithEarned['criteria_type'], criteria_config, slug }))
    expect(b('first_crawl', {})).toBe('Make your first list of wing spots.')
    expect(b('crawl_with_n_spots', { min_items: 5 })).toBe('Make a list with 5 or more wing spots.')
    expect(b('rating_at_or_below', { count: 5, max_rating: 4 })).toBe('Give a rating of 4 or lower on 5 reviews.')
    expect(b('crawl_comment_contains', {}, 'crawl-hot-take')).toMatch(/overrated/)
    expect(b('review_text_long', { min_length: 300 })).toBe('Write a review with at least 300 characters.')
  })
})
