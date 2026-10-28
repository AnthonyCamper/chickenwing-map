import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Register from './Register'

// The profile-link preview looks up usernames already in use.
const taken = vi.hoisted(() => ({ profiles: [] as string[], history: [] as string[] }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        like: () => ({
          limit: () => Promise.resolve({
            data: (table === 'profiles' ? taken.profiles : taken.history).map(username => ({ username })),
            error: null,
          }),
        }),
      }),
    }),
  },
}))

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
    expect(screen.getByText(/by creating an account you confirm you are 13 or older and agree/i)).toBeInTheDocument()
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

  it('shows the profile link the display name will become, with -2 when taken (Q12)', async () => {
    taken.profiles = ['sam-skeptic']
    taken.history = []
    renderPage()
    expect(screen.getByText(/used for your profile link/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Sam Skeptic' } })
    expect(screen.getByText('wingkingtony.com/u/sam-skeptic')).toBeInTheDocument()
    expect(await screen.findByText('wingkingtony.com/u/sam-skeptic-2')).toBeInTheDocument()
    expect(screen.getByText(/you can change it later/i)).toBeInTheDocument()
  })

  it('says "already exists" in plain words with Sign in / Reset password links (Q27)', async () => {
    const onSignUp = vi.fn().mockResolvedValue({ error: 'User already registered' })
    renderPage({ onSignUp })
    fill('Tony', 'tony@example.com', 'longenough')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('An account with this email already exists. Sign in instead, or reset your password.')
    expect(alert).not.toHaveTextContent(/user already registered/i)
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Reset password' })).toHaveAttribute('href', '/login')
  })

  it('uses plain words, not "Join the wing council" (Q40)', () => {
    renderPage()
    expect(screen.queryByText(/wing council/i)).toBeNull()
  })
})

