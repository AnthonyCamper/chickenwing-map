import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }) } },
}))

import Login from './Login'

function renderPage(props: Partial<React.ComponentProps<typeof Login>> = {}, state?: unknown) {
  const onSignInEmail = vi.fn().mockResolvedValue({ error: 'Invalid login credentials' })
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Login onSignInGoogle={vi.fn()} onSignInEmail={onSignInEmail} isPublic {...props} />
      </MemoryRouter>
    </HelmetProvider>
  )
  return { onSignInEmail }
}

describe('Login', () => {
  it('says "Email or password is wrong" instead of the raw error, with a reset button (Q27)', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with email' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Email or password is wrong. Try again or reset your password.')
    expect(alert).not.toHaveTextContent(/invalid login credentials/i)

    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }))
    expect(screen.getByText('Reset your password')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('sam@example.com')
  })

  it('maps an OAuth error from the redirect too', () => {
    renderPage({ authError: 'User already registered' })
    expect(screen.getByRole('alert')).toHaveTextContent(/an account with this email already exists/i)
  })

  it('opens the reset form with the email filled in when Register sends someone here', () => {
    renderPage({}, { email: 'tony@example.com', forgot: true })
    expect(screen.getByText('Reset your password')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('tony@example.com')
  })

  it('uses plain words, not "The wing council" (Q40)', () => {
    renderPage()
    expect(screen.queryByText(/wing council/i)).toBeNull()
  })
})
