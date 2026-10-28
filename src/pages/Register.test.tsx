import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Register from './Register'

function renderPage(props: Partial<React.ComponentProps<typeof Register>> = {}) {
  const onSignUp = vi.fn().mockResolvedValue({ error: null })
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/register']}>
        <Register onSignUp={onSignUp} {...props} />
      </MemoryRouter>
    </HelmetProvider>
  )
  return { onSignUp }
}

function fill(name: string, email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

describe('Register', () => {
  it('is called "Create account", says it is free, and has no "Request access" (F03)', async () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByText(/free, and your account works right away/i)).toBeInTheDocument()
    expect(screen.queryByText(/request access/i)).toBeNull()
    await waitFor(() => expect(document.title).toBe('Create account — WingKingTony'))
  })

  it('mentions admin approval only on a private site', () => {
    renderPage({ isPublic: false })
    expect(screen.getByText(/admin approves new accounts/i)).toBeInTheDocument()
  })

  it('keeps submit disabled for a 7-character password and says why (F26)', () => {
    renderPage()
    fill('Tony', 'tony@example.com', '1234567')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(screen.getAllByText(/at least 8 characters \(1 more\)/i).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: '12345678' } })
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  })

  it('rejects an email without a dot in the domain with a plain message (F33)', () => {
    renderPage()
    fill('Tony', 'tony@example', 'longenough')
    fireEvent.blur(screen.getByLabelText('Email'))
    expect(screen.getAllByText(/full email address, for example name@gmail.com/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('treats a spaces-only name as missing, and trims what it sends', async () => {
    const { onSignUp } = renderPage()
    fill('   ', 'tony@example.com', 'longenough')
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()

    fill('  Tony  ', ' tony@example.com ', 'longenough')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    await waitFor(() => expect(onSignUp).toHaveBeenCalledWith('tony@example.com', 'longenough', 'Tony', undefined))
  })

  it('has consent links, says what is public, and "Sign in" opens the sign-in form (F18, F42)', () => {
    renderPage()
    expect(screen.getByText(/by creating an account you agree/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /^terms$/i })[0]).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy')
    expect(screen.getByText(/reviews, photos and comments are public/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })

  it('does not use a dotted placeholder on the password field (F28)', () => {
    renderPage()
    expect(screen.getByLabelText('Password')).not.toHaveAttribute('placeholder', expect.stringContaining('•'))
  })

  it('has a way back to the site and the same "Continue with Google" as Login (r2 skeptic 11)', () => {
    const onSignInGoogle = vi.fn().mockResolvedValue(undefined)
    renderPage({ onSignInGoogle })
    expect(screen.getByRole('link', { name: /back to wingkingtony/i })).toHaveAttribute('href', '/')
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(onSignInGoogle).toHaveBeenCalledTimes(1)
  })
})
