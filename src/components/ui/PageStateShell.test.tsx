import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import PageStateShell from './PageStateShell'

// AppHeader pulls in auth context, notifications and supabase.
vi.mock('../AppHeader', () => ({ default: () => null }))

describe('PageStateShell', () => {
  it('sets the tab title for a not-found state (r2 breaker 11)', async () => {
    render(
      <HelmetProvider>
        <PageStateShell title="Spot not found — WingKingTony">
          <h1>Spot not found</h1>
        </PageStateShell>
      </HelmetProvider>
    )
    await waitFor(() => expect(document.title).toBe('Spot not found — WingKingTony'))
  })
})
