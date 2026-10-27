import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthGateProvider, useAuthGate } from './AuthGateModal'
import { peekReturnTo } from '../lib/authReturn'

function LogWingButton() {
  const { requireAuth } = useAuthGate()
  return <button onClick={() => requireAuth()}>Log a wing here</button>
}

function renderAt(path = '/spots/ale-marys') {
  // jsdom's window.location doesn't follow MemoryRouter; mirror the spot URL
  // so rememberReturnTo() records what the real app would.
  window.history.replaceState({}, '', path)
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthGateProvider isAuthenticated={false}>
        <Routes>
          <Route path="/spots/:slug" element={<LogWingButton />} />
          <Route path="/register" element={<p>register page</p>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </AuthGateProvider>
    </MemoryRouter>
  )
}

beforeEach(() => sessionStorage.clear())

describe('AuthGateModal', () => {
  it('closes when "Create an account" navigates, and remembers the spot (F30, F15)', () => {
    renderAt()
    fireEvent.click(screen.getByText('Log a wing here'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByText('register page')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(peekReturnTo()).toBe('/spots/ale-marys')
  })

  it('closes when "Sign in" navigates', () => {
    renderAt()
    fireEvent.click(screen.getByText('Log a wing here'))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('"Continue browsing" closes it and forgets any return-to', () => {
    sessionStorage.setItem('auth-return-to', JSON.stringify({ path: '/lists/new', at: Date.now() }))
    renderAt()
    fireEvent.click(screen.getByText('Log a wing here'))
    fireEvent.click(screen.getByRole('button', { name: /continue browsing/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(peekReturnTo()).toBeNull()
  })
})
