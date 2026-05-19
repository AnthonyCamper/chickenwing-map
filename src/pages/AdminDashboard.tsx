import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminUsers } from '../hooks/useAdminUsers'
import AdminEventsTab from '../components/admin/AdminEventsTab'
import type { UserProfile, UserStatus } from '../lib/types'

type Tab = 'pending' | 'users' | 'events' | 'settings'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const admin = useAdminUsers()

  const pendingUsers = admin.users.filter(u => u.status === 'pending')
  const [tab, setTab] = useState<Tab>(pendingUsers.length > 0 ? 'pending' : 'users')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const withLoading = async (id: string, fn: () => Promise<void>) => {
    setActionLoading(id)
    try { await fn() } finally { setActionLoading(null) }
  }

  const filteredUsers = admin.users.filter(u => {
    if (u.status === 'pending') return false // pending lives in its own tab
    if (statusFilter !== 'all' && u.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (u.display_name ?? u.full_name ?? '').toLowerCase()
      const email = u.email.toLowerCase()
      if (!name.includes(q) && !email.includes(q)) return false
    }
    return true
  })

  return (
    <div className="min-h-dvh bg-warmgray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-warmgray-50/90 backdrop-blur-md border-b border-warmgray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="btn-ghost px-2 py-1.5 text-charcoal-500"
            aria-label="Back"
          >
            ← Back
          </button>
          <h1 className="font-display text-lg text-charcoal-800 flex-1">Admin Dashboard</h1>
          <button onClick={admin.refresh} className="btn-ghost px-2 py-1.5 text-charcoal-400 text-xs">
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto px-4 pb-0 flex gap-1">
          {(['pending', 'users', 'events', 'settings'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${
                tab === t
                  ? 'border-amber-400 text-amber-500'
                  : 'border-transparent text-charcoal-400 hover:text-charcoal-600'
              }`}
            >
              {t === 'pending' ? (
                <>
                  Pending
                  {pendingUsers.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-white text-xs font-bold">
                      {pendingUsers.length}
                    </span>
                  )}
                </>
              ) : t === 'users' ? 'Users'
                : t === 'events' ? 'Events'
                : 'Settings'}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {admin.loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Pending tab ───────────────────────────────────────────────── */}
            {tab === 'pending' && (
              <div className="space-y-3">
                {pendingUsers.length === 0 ? (
                  <div className="text-center py-16 text-charcoal-400">
                    <p className="text-4xl mb-3">✓</p>
                    <p className="font-medium">No pending requests</p>
                  </div>
                ) : (
                  pendingUsers.map(u => (
                    <UserCard key={u.id} user={u} actionLoading={actionLoading}>
                      <button
                        onClick={() => withLoading(u.id + '-approve', () => admin.approveUser(u.id))}
                        disabled={actionLoading !== null}
                        className="btn-primary px-4 py-2 text-sm"
                      >
                        {actionLoading === u.id + '-approve' ? <Spinner /> : 'Approve'}
                      </button>
                      <button
                        onClick={() => withLoading(u.id + '-reject', () => admin.rejectUser(u.id))}
                        disabled={actionLoading !== null}
                        className="btn-danger px-4 py-2 text-sm"
                      >
                        {actionLoading === u.id + '-reject' ? <Spinner /> : 'Reject'}
                      </button>
                    </UserCard>
                  ))
                )}
              </div>
            )}

            {/* ── Users tab ─────────────────────────────────────────────────── */}
            {tab === 'users' && (
              <div className="space-y-4">
                {/* Search + filter */}
                <div className="flex gap-2">
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name or email…"
                    className="input flex-1"
                  />
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as UserStatus | 'all')}
                    className="input w-36"
                  >
                    <option value="all">All</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="text-center py-16 text-charcoal-400">
                    <p className="font-medium">No users match</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map(u => (
                      <div key={u.id} className="card px-5 py-4">
                        <div className="flex items-start gap-3 mb-4">
                          <Avatar user={u} />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-charcoal-700 truncate text-sm">
                              {u.display_name ?? u.full_name ?? u.email}
                            </p>
                            <p className="text-xs text-charcoal-400 truncate">{u.email}</p>
                            <p className="text-xs text-charcoal-300 mt-0.5">
                              Joined {new Date(u.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <StatusBadge status={u.status} />
                        </div>

                        {/* Toggles row */}
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-warmgray-100">
                          {/* Admin toggle */}
                          <Toggle
                            label="Admin"
                            checked={u.is_admin}
                            loading={actionLoading === u.id + '-admin'}
                            disabled={actionLoading !== null}
                            onChange={v => withLoading(u.id + '-admin', () => admin.setAdmin(u.id, v))}
                          />

                          {/* Can review toggle */}
                          <Toggle
                            label="Can review"
                            checked={u.can_leave_reviews}
                            loading={actionLoading === u.id + '-review'}
                            disabled={actionLoading !== null}
                            onChange={v => withLoading(u.id + '-review', () => admin.setCanReview(u.id, v))}
                          />

                          {/* Disable / Enable */}
                          {u.status === 'disabled' ? (
                            <button
                              onClick={() => withLoading(u.id + '-enable', () => admin.enableUser(u.id))}
                              disabled={actionLoading !== null}
                              className="ml-auto btn-secondary px-3 py-1.5 text-xs"
                            >
                              {actionLoading === u.id + '-enable' ? <Spinner /> : 'Re-enable'}
                            </button>
                          ) : u.status === 'approved' ? (
                            <button
                              onClick={() => withLoading(u.id + '-disable', () => admin.disableUser(u.id))}
                              disabled={actionLoading !== null}
                              className="ml-auto btn-danger px-3 py-1.5 text-xs"
                            >
                              {actionLoading === u.id + '-disable' ? <Spinner /> : 'Disable'}
                            </button>
                          ) : (
                            <button
                              onClick={() => withLoading(u.id + '-approve', () => admin.approveUser(u.id))}
                              disabled={actionLoading !== null}
                              className="ml-auto btn-primary px-3 py-1.5 text-xs"
                            >
                              {actionLoading === u.id + '-approve' ? <Spinner /> : 'Approve'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Events tab ────────────────────────────────────────────────── */}
            {tab === 'events' && <AdminEventsTab />}

            {/* ── Settings tab ──────────────────────────────────────────────── */}
            {tab === 'settings' && (
              <div className="space-y-4">
                <div className="card px-6 py-6">
                  <h2 className="font-display text-lg text-charcoal-800 mb-1">Site access</h2>
                  <p className="text-sm text-charcoal-400 mb-5 leading-relaxed">
                    When the site is <strong>public</strong>, anyone can browse the wing spot list
                    and reviews without an account. When <strong>private</strong>, a login is required
                    to see anything.
                  </p>

                  <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-warmgray-50 border border-warmgray-200">
                    <div>
                      <p className="font-semibold text-charcoal-700 text-sm">
                        {admin.siteSettings?.is_public ? 'Public site' : 'Private site'}
                      </p>
                      <p className="text-xs text-charcoal-400 mt-0.5">
                        {admin.siteSettings?.is_public
                          ? 'Visible to anyone, no login required'
                          : 'Login required to view any content'}
                      </p>
                    </div>
                    <button
                      onClick={() => admin.setSitePublic(!admin.siteSettings?.is_public)}
                      className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                        admin.siteSettings?.is_public ? 'bg-amber-400' : 'bg-warmgray-300'
                      }`}
                      role="switch"
                      aria-checked={admin.siteSettings?.is_public}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          admin.siteSettings?.is_public ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// ── Helper sub-components ──────────────────────────────────────────────────────

function Avatar({ user }: { user: UserProfile }) {
  const name = user.display_name ?? user.full_name ?? user.email
  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-warmgray-100 flex items-center justify-center flex-shrink-0">
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-sm font-semibold text-charcoal-500">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    approved: 'bg-green-100 text-green-700',
    pending:  'bg-amber-100 text-amber-700',
    rejected: 'bg-red-100 text-red-600',
    disabled: 'bg-warmgray-200 text-charcoal-500',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function Toggle({
  label,
  checked,
  loading,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  loading: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        className={`relative w-9 h-5 rounded-full transition-colors duration-150 ${
          checked ? 'bg-amber-400' : 'bg-warmgray-300'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-3 h-3 rounded-full border border-white border-t-transparent animate-spin" />
          </span>
        )}
      </div>
      <span className="text-xs font-medium text-charcoal-600">{label}</span>
    </label>
  )
}

function UserCard({
  user,
  actionLoading,
  children,
}: {
  user: UserProfile
  actionLoading: string | null
  children: React.ReactNode
}) {
  return (
    <div className="card px-5 py-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-charcoal-700 truncate text-sm">
            {user.display_name ?? user.full_name ?? user.email}
          </p>
          <p className="text-xs text-charcoal-400 truncate">{user.email}</p>
          <p className="text-xs text-charcoal-300 mt-0.5">
            Requested {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {children}
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
}
