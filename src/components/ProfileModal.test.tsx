import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AuthState } from '../hooks/useAuth'

const mocks = vi.hoisted(() => ({
  deleteOwnAccount: vi.fn(),
  changePassword: vi.fn(),
  verifyCurrentPassword: vi.fn(),
}))

vi.mock('../lib/supabase', () => {
  const countQuery = { select: () => countQuery, eq: () => Promise.resolve({ count: 0 }) }
  return { supabase: { from: () => countQuery, storage: { from: () => ({}) } } }
})
vi.mock('../hooks/useBadges', () => ({
  useBadges: () => ({ earned: [], locked: [], badges: [], loading: false }),
}))
vi.mock('../hooks/useLeaderboard', () => ({
  useLeaderboard: () => ({ rows: [], loading: false }),
}))
vi.mock('../hooks/useAuth', async importOriginal => ({
  ...(await importOriginal<typeof import('../hooks/useAuth')>()),
  deleteOwnAccount: mocks.deleteOwnAccount,
  changePassword: mocks.changePassword,
  verifyCurrentPassword: mocks.verifyCurrentPassword,
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import ProfileModal from './ProfileModal'

function makeAuth(overrides: Partial<AuthState> = {}, provider = 'email'): AuthState {
  return {
    session: null,
    user: { id: 'u1', email: 'sam@example.com', app_metadata: { provider, providers: [provider] } } as unknown as AuthState['user'],
    status: 'authorized',
    isAdmin: false,
    canLeaveReviews: true,
    profile: {
      id: 'u1', email: 'sam@example.com', full_name: 'Sam', display_name: 'Sam', username: 'sam',
      avatar_url: null, bio: null, status: 'approved', is_admin: false, can_leave_reviews: true,
      is_private: false, created_at: '2026-01-01',
    },
    siteSettings: { is_public: true },
    authError: null,
    signInWithGoogle: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue(true),
    refreshProfile: vi.fn(),
    ...overrides,
  } as AuthState
}

beforeEach(() => vi.clearAllMocks())

describe('ProfileModal', () => {
  it('does not show an "Approved" pill to a normal approved user (F03)', () => {
    render(<ProfileModal auth={makeAuth()} onClose={vi.fn()} />)
    expect(screen.queryByText(/approved/i)).toBeNull()
  })

  it('shows an inline error for a spaces-only display name instead of "Profile updated" (F39)', () => {
    const auth = makeAuth()
    const onClose = vi.fn()
    render(<ProfileModal auth={auth} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: '     ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/only spaces/i)
    expect(auth.updateProfile).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('saves a trimmed name and stays open if the save fails', async () => {
    const auth = makeAuth({ updateProfile: vi.fn().mockResolvedValue(false) })
    const onClose = vi.fn()
    render(<ProfileModal auth={auth} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: '  Sam S  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(auth.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Sam S' })))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('describes what "Private profile" actually does (F27)', () => {
    render(<ProfileModal auth={makeAuth()} onClose={vi.fn()} />)
    expect(screen.getByRole('switch', { name: /private profile/i })).toHaveTextContent(/your reviews stay public/i)
  })

  it('offers "Change password" only to email/password accounts (F19)', () => {
    const { unmount } = render(<ProfileModal auth={makeAuth()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument()
    unmount()
    render(<ProfileModal auth={makeAuth({}, 'google')} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /change password/i })).toBeNull()
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument()
  })

  it('changes the password after checking the current one', async () => {
    mocks.changePassword.mockResolvedValue({ error: null })
    render(<ProfileModal auth={makeAuth()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'oldpassword' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpassword' } })
    fireEvent.change(screen.getByLabelText('Type the new password again'), { target: { value: 'newpassword' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    await waitFor(() => expect(mocks.changePassword).toHaveBeenCalledWith('sam@example.com', 'oldpassword', 'newpassword'))
  })

  it('only deletes the account after DELETE is typed (F19)', async () => {
    mocks.deleteOwnAccount.mockResolvedValue({ error: 'boom' })
    render(<ProfileModal auth={makeAuth({}, 'google')} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }))
    const confirm = screen.getByRole('button', { name: 'Delete forever' })
    expect(confirm).toBeDisabled()
    expect(screen.getByText(/can’t be undone/i)).toBeInTheDocument()
    // Google-only accounts have no password to ask for.
    expect(screen.queryByLabelText('Your password')).toBeNull()

    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'delete' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(mocks.deleteOwnAccount).toHaveBeenCalledWith('u1'))
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
    expect(mocks.verifyCurrentPassword).not.toHaveBeenCalled()
  })

  it('asks email/password accounts for their password before deleting (r2 skeptic 8)', async () => {
    mocks.verifyCurrentPassword.mockResolvedValueOnce('Your current password is not correct.')
    mocks.deleteOwnAccount.mockResolvedValue({ error: 'boom' })
    render(<ProfileModal auth={makeAuth()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }))
    const confirm = screen.getByRole('button', { name: 'Delete forever' })
    fireEvent.change(screen.getByLabelText(/type delete to confirm/i), { target: { value: 'DELETE' } })
    expect(confirm).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'wrongpass' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    expect(await screen.findByRole('alert')).toHaveTextContent(/current password is not correct/i)
    expect(mocks.verifyCurrentPassword).toHaveBeenCalledWith('sam@example.com', 'wrongpass')
    expect(mocks.deleteOwnAccount).not.toHaveBeenCalled()

    mocks.verifyCurrentPassword.mockResolvedValueOnce(null)
    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'rightpass' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(mocks.deleteOwnAccount).toHaveBeenCalledWith('u1'))
  })

  it('does not let an admin delete their account here', () => {
    render(<ProfileModal auth={makeAuth({ isAdmin: true })} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /delete account/i }))
    expect(screen.getByText(/admin accounts can’t be deleted here/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete forever' })).toBeNull()
  })
})
