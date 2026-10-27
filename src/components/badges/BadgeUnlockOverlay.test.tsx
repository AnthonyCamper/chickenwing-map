import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import BadgeUnlockOverlay from './BadgeUnlockOverlay'
import { BADGES_UNLOCKED_EVENT } from '../../lib/badgeUnlocks'
import type { BadgeWithEarned } from '../../lib/types'

function makeBadge(overrides: Partial<BadgeWithEarned> = {}): BadgeWithEarned {
  return {
    id: 'b1',
    slug: 'first-flight',
    name: 'First Flight',
    description: 'Post your first review.',
    icon: '🍗',
    color: 'amber',
    criteria_type: 'first_review',
    criteria_config: {},
    event_id: null,
    sort_order: 1,
    earned: true,
    earned_at: '2026-07-24T00:00:00Z',
    ...overrides,
  }
}

function fireUnlock(badges: BadgeWithEarned[]) {
  act(() => {
    window.dispatchEvent(new CustomEvent(BADGES_UNLOCKED_EVENT, { detail: { badges } }))
  })
}

describe('BadgeUnlockOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing until an unlock event fires', () => {
    render(<BadgeUnlockOverlay />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows badge name and rarity after an unlock event', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([makeBadge({ earned_count: 4, member_count: 34 })])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('First Flight')).toBeInTheDocument()
    expect(screen.getByText('Rare')).toBeInTheDocument()
    expect(screen.getByText(/Only 12% of members/)).toBeInTheDocument()
  })

  it('labels a badge half the members hold as Common, not Uncommon', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([makeBadge({ earned_count: 49, member_count: 100 })])
    expect(screen.getByText('Common')).toBeInTheDocument()
    expect(screen.queryByText('Uncommon')).not.toBeInTheDocument()
    expect(screen.getByText('49 of 100 members have this')).toBeInTheDocument()
  })

  it('celebrates being the first to earn a badge', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([makeBadge({ earned_count: 1, member_count: 34 })])
    expect(screen.getByText(/First to earn this!/)).toBeInTheDocument()
  })

  it('marks event-exclusive badges with the event name', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([makeBadge({ event_id: 'e1', event_name: 'Ottawa Wing Crawl', earned_count: 4, member_count: 34 })])
    expect(screen.getByText('★ Event exclusive')).toBeInTheDocument()
    expect(screen.getByText(/Earned at Ottawa Wing Crawl/)).toBeInTheDocument()
  })

  it('shows several badges from one action in a single overlay', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([
      makeBadge({ id: 'b1', name: 'First Flight' }),
      makeBadge({ id: 'b2', name: 'Heat Seeker' }),
      makeBadge({ id: 'b3', name: 'Crispy or Die' }),
    ])
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByText('You unlocked 3 badges')).toBeInTheDocument()
    expect(screen.getByText('First Flight')).toBeInTheDocument()
    expect(screen.getByText('Heat Seeker')).toBeInTheDocument()
    expect(screen.getByText('Crispy or Die')).toBeInTheDocument()
    // One tap closes everything — no "Next badge" chain.
    expect(screen.queryByRole('button', { name: /Next badge/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('has a Close button', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([makeBadge()])
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('skips the rarity line when stats are missing', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([makeBadge()])
    expect(screen.getByText('First Flight')).toBeInTheDocument()
    expect(screen.queryByText(/members have this|of members/)).not.toBeInTheDocument()
  })
})
