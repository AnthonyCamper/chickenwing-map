import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import type { AuthState } from '../hooks/useAuth'
import type { UserProfile } from '../lib/types'

// A tiny stand-in for the supabase query builder: every chain method returns
// the builder; awaiting it (or .maybeSingle()) answers from `db` by table.
const db = vi.hoisted(() => ({
  viewerId: '' as string,
  profiles: [] as Record<string, unknown>[],
  history: [] as { username: string; user_id: string }[],
}))

vi.mock('../lib/supabase', () => {
  function query(table: string) {
    const filters: Record<string, unknown> = {}
    const rows = () => {
      if (table === 'profiles') return db.profiles.filter(p => Object.entries(filters).every(([k, v]) => p[k] === v))
      if (table === 'profile_username_history') return db.history.filter(h => h.username === filters.username)
      return []
    }
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'in', 'match']) b[m] = () => b
    b.eq = (k: string, v: unknown) => { filters[k] = v; return b }
    b.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null })
    b.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null, count: 0 }).then(res)
    return b
  }
  return {
    supabase: {
      from: query,
      auth: { getSession: () => Promise.resolve({ data: { session: db.viewerId ? { user: { id: db.viewerId } } : null } }) },
    },
  }
})
vi.mock('../components/AppHeader', () => ({ default: () => null }))

const authRef = vi.hoisted(() => ({ current: null as AuthState | null }))
vi.mock('../components/AuthProvider', () => ({ useAuthContext: () => authRef.current }))

import UserProfilePage, { canonicalUsername } from './UserProfilePage'

const SAM: UserProfile = {
  id: 'u1', email: '', full_name: 'Sam', display_name: 'Sam', username: 'sam', avatar_url: null,
  bio: null, status: 'approved', is_admin: false, can_leave_reviews: true, is_private: false, created_at: '2026-01-01',
}

function renderAt(path: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/u/:username" element={<UserProfilePage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  )
}

beforeEach(() => {
  db.viewerId = ''
  db.profiles = [{ ...SAM }]
  db.history = []
  authRef.current = null
})

describe('UserProfilePage', () => {
  it('shows "Edit profile" on your own page, not Follow (Q47)', async () => {
    db.viewerId = 'u1'
    authRef.current = { profile: { ...SAM } } as unknown as AuthState
    renderAt('/u/sam')
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull()
  })

  it('shows the saved profile straight away, without a reload (Q24)', async () => {
    db.viewerId = 'u1'
    // The page fetched the old row; Edit profile → Save updated the app's
    // signed-in profile (auth context) with the new name and bio.
    authRef.current = { profile: { ...SAM, display_name: 'Sam S', bio: 'Wing nerd' } } as unknown as AuthState
    renderAt('/u/sam')
    expect(await screen.findByRole('heading', { level: 1, name: 'Sam S' })).toBeInTheDocument()
    expect(screen.getByText('Wing nerd')).toBeInTheDocument()
  })

  it('spells out "Average rating" (Q40)', async () => {
    renderAt('/u/sam')
    expect(await screen.findByText('Average rating')).toBeInTheDocument()
    expect(screen.queryByText(/^avg$/i)).toBeNull()
  })

  it('shows "Private profile" to others, but the owner sees their page (Q35)', async () => {
    db.profiles = [{ ...SAM, is_private: true }]
    const { unmount } = renderAt('/u/sam')
    expect(await screen.findByRole('heading', { name: 'Private profile' })).toBeInTheDocument()
    unmount()

    db.viewerId = 'u1'
    authRef.current = { profile: { ...SAM, is_private: true } } as unknown as AuthState
    renderAt('/u/sam')
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
    expect(screen.getByText(/your profile is private/i)).toBeInTheDocument()
  })

  it('sends an old username on to the current one (Q12)', async () => {
    db.profiles = [{ ...SAM, username: 'sam-s' }]
    db.history = [{ username: 'sam', user_id: 'u1' }]
    renderAt('/u/sam')
    expect(await screen.findByText('@sam-s')).toBeInTheDocument()
  })

  it('opens /u/<Any Casing>, "@name" and stray spaces on the lowercase profile (m2 S08)', async () => {
    db.profiles = [{ ...SAM, username: 'wingkingtony', display_name: 'WingKingTony' }]
    for (const path of ['/u/WingKingTony', '/u/%40WINGKINGTONY', '/u/wingkingtony%20']) {
      const { unmount } = renderAt(path)
      expect(await screen.findByText('@wingkingtony')).toBeInTheDocument()
      unmount()
    }
  })

  it('cleans bidi tricks and Zalgo out of names and bios (Q11)', async () => {
    db.profiles = [{ ...SAM, display_name: 'Ev‮il', bio: 'Z' + '́'.repeat(40) }]
    renderAt('/u/sam')
    const h1 = await screen.findByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Evil')
    expect(h1).toHaveClass('user-text')
    expect(screen.getByText('Ź́')).toHaveClass('user-text')
  })
})

describe('canonicalUsername', () => {
  it('lowercases, trims and drops a leading @', () => {
    expect(canonicalUsername('BREAKER-M2-THREE')).toBe('breaker-m2-three')
    expect(canonicalUsername(' @Sam ')).toBe('sam')
    expect(canonicalUsername('sam')).toBe('sam')
  })
})
