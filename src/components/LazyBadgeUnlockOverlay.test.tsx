import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { BADGES_UNLOCKED_EVENT } from '../lib/badgeUnlocks'

vi.mock('./badges/BadgeUnlockOverlay', async () => {
  const { useEffect, useState } = await import('react')
  return {
    default: function FakeOverlay() {
      const [seen, setSeen] = useState<string[]>([])
      useEffect(() => {
        const h = (e: Event) => setSeen(s => [...s, (e as CustomEvent).detail.badges[0].name])
        window.addEventListener('badges-unlocked', h)
        return () => window.removeEventListener('badges-unlocked', h)
      }, [])
      return <p data-testid="overlay">{seen.join(',')}</p>
    },
  }
})

import LazyBadgeUnlockOverlay from './LazyBadgeUnlockOverlay'

const announce = (name: string) =>
  window.dispatchEvent(new CustomEvent(BADGES_UNLOCKED_EVENT, { detail: { badges: [{ name }] } }))

describe('LazyBadgeUnlockOverlay', () => {
  it('loads nothing until a badge is announced, then shows that announcement once', async () => {
    render(<LazyBadgeUnlockOverlay />)
    expect(screen.queryByTestId('overlay')).toBeNull()
    act(() => announce('First bite'))
    await waitFor(() => expect(screen.getByTestId('overlay')).toHaveTextContent(/^First bite$/), { timeout: 5000 })
    act(() => announce('Saucy'))
    expect(screen.getByTestId('overlay')).toHaveTextContent(/^First bite,Saucy$/)
  })
})
