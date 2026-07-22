import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import ResetPassword from './ResetPassword'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      updateUser: mocks.updateUser,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<div>HOME</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mocks.unsubscribe } },
  })
})

describe('ResetPassword', () => {
  it('shows the new-password form once a recovery session exists', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })

    renderPage()

    expect(await screen.findByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
  })

  it('updates the password and navigates home on success', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    mocks.updateUser.mockResolvedValue({ data: {}, error: null })

    renderPage()

    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'supersecret1' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'supersecret1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'supersecret1' })
      expect(screen.getByText('HOME')).toBeInTheDocument()
    })
  })

  it('rejects mismatched passwords without calling supabase', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })

    renderPage()

    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'supersecret1' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different1234' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Passwords don't match")
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('shows the expired-link state when no session ever arrives', async () => {
    vi.useFakeTimers()
    try {
      mocks.getSession.mockResolvedValue({ data: { session: null } })

      renderPage()

      // Flush the getSession microtask, then run out the grace window.
      await act(async () => { await Promise.resolve() })
      act(() => { vi.advanceTimersByTime(3100) })

      expect(screen.getByText("That link's cold")).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /back to sign in/i })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
