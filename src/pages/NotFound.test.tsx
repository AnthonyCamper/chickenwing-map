import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import NotFound from './NotFound'

// PageStateShell pulls in AppHeader (auth context, notifications, supabase);
// this test only cares about NotFound's own content.
vi.mock('../components/ui/PageStateShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('NotFound', () => {
  it('renders the branded 404 state with a link home', () => {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/some/bogus/path']}>
          <NotFound />
        </MemoryRouter>
      </HelmetProvider>
    )

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Nothing on this bone')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /back to the map/i })
    expect(link).toHaveAttribute('href', '/')
  })
})
