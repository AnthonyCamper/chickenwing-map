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
    fireUnlock([makeBadge({ earned_count: 8, member_count: 34 })])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('First Flight')).toBeInTheDocument()
    expect(screen.getByText('Rare')).toBeInTheDocument()
    expect(screen.getByText(/Only 24% of members/)).toBeInTheDocument()
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

  it('queues multiple badges and advances one at a time', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([
      makeBadge({ id: 'b1', name: 'First Flight' }),
      makeBadge({ id: 'b2', name: 'Heat Seeker' }),
    ])
    expect(screen.getByText('First Flight')).toBeInTheDocument()
    expect(screen.getByText('1 of 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Next badge/ }))
    expect(screen.getByText('Heat Seeker')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Wear it proud/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('skips the rarity line when stats are missing', () => {
    render(<BadgeUnlockOverlay />)
    fireUnlock([makeBadge()])
    expect(screen.getByText('First Flight')).toBeInTheDocument()
    expect(screen.queryByText(/members have this|of members/)).not.toBeInTheDocument()
  })
})
