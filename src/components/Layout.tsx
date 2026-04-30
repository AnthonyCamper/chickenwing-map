import { ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthState } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useHistoryModal } from '../hooks/useHistoryModal'
import ProfileModal from './ProfileModal'
import NotificationBell from './NotificationBell'
import NotificationSettings from './NotificationSettings'

type View = 'list' | 'map' | 'gallery'

interface Props {
  auth: AuthState
  view: View
  onViewChange: (v: View) => void
  onAddReview: () => void
  readOnly?: boolean
  children: ReactNode
}

const VIEWS: { key: View; label: string; icon: string }[] = [
  { key: 'list',    label: 'List',   icon: '☰' },
  { key: 'map',     label: 'Map',    icon: '🗺' },
  { key: 'gallery', label: 'Photos', icon: '📷' },
]

export default function Layout({ auth, view, onViewChange, onAddReview, readOnly = false, children }: Props) {
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showNotifSettings, setShowNotifSettings] = useState(false)
  const notificationsHook = useNotifications(auth.user?.id)

  // Browser back / swipe-back closes these modals
  useHistoryModal(showProfileModal, () => setShowProfileModal(false))
  useHistoryModal(showNotifSettings, () => setShowNotifSettings(false))

  const user = auth.user
  const profile = auth.profile
  const avatar = profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined)
  const name = profile?.display_name ?? profile?.full_name
    ?? (user?.user_metadata?.full_name as string | undefined)
    ?? user?.email ?? ''
  const email = user?.email ?? ''

  return (
    <div className="min-h-dvh flex flex-col bg-warmgray-50">
      {/* ── Header — accounts for iPhone status bar via safe-area-inset-top */}
      <header
        className="sticky top-0 z-40 bg-warmgray-50/95 backdrop-blur-md border-b border-warmgray-200"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-lg" aria-hidden="true" />
            <h1 className="font-display text-base sm:text-lg text-charcoal-800 truncate leading-tight">
              WingMap
            </h1>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-warmgray-100 rounded-xl p-1 border border-warmgray-200 flex-shrink-0">
            {VIEWS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => onViewChange(key)}
                aria-label={label}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1 ${
                  view === key
                    ? 'bg-white text-charcoal-700 shadow-soft'
                    : 'text-charcoal-400 hover:text-charcoal-600'
                }`}
              >
                <span>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Notifications + Profile */}
          {user ? (
            <div className="flex items-center gap-1 flex-shrink-0">
            <NotificationBell notifications={notificationsHook} />
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-warmgray-200 hover:ring-amber-300 transition-all flex items-center justify-center bg-warmgray-200"
                aria-label="Profile menu"
              >
                {avatar ? (
                  <img src={avatar} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-charcoal-600">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {profileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-elevated border border-warmgray-100 overflow-hidden z-50 animate-slide-up">
                    <div className="px-4 py-3 border-b border-warmgray-100">
                      <p className="text-sm font-semibold text-charcoal-700 truncate">{name}</p>
                      <p className="text-xs text-charcoal-400 truncate mt-0.5">{email}</p>
                      {auth.isAdmin && (
                        <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-600">
                          Admin
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => { setProfileOpen(false); setShowProfileModal(true) }}
                      className="w-full px-4 py-3.5 text-left text-sm text-charcoal-600 hover:bg-warmgray-50 active:bg-warmgray-100 transition-colors"
                    >
                      My Profile
                    </button>

                    <button
                      onClick={() => { setProfileOpen(false); setShowNotifSettings(true) }}
                      className="w-full px-4 py-3.5 text-left text-sm text-charcoal-600 hover:bg-warmgray-50 active:bg-warmgray-100 transition-colors border-t border-warmgray-100"
                    >
                      Notification Settings
                    </button>

                    {auth.isAdmin && (
                      <button
                        onClick={() => { setProfileOpen(false); navigate('/admin') }}
                        className="w-full px-4 py-3.5 text-left text-sm text-charcoal-600 hover:bg-warmgray-50 active:bg-warmgray-100 transition-colors border-t border-warmgray-100"
                      >
                        Admin Dashboard
                      </button>
                    )}

                    <button
                      onClick={async () => { setProfileOpen(false); await auth.signOut() }}
                      className="w-full px-4 py-3.5 text-left text-sm text-charcoal-600 hover:bg-warmgray-50 active:bg-warmgray-100 transition-colors border-t border-warmgray-100"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="btn-secondary px-3 py-2 text-xs flex-shrink-0"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 relative">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="border-t border-warmgray-200 px-4 py-5 text-center bg-warmgray-50"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <p className="text-xs text-charcoal-400">
          Friends of WingMap{' '}
          <span aria-hidden="true" className="text-charcoal-300">·</span>{' '}
          <a
            href="https://winkingtony.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-amber-600 hover:text-amber-700 underline-offset-2 hover:underline transition-colors inline-flex items-center gap-0.5"
          >
            Winking Tony
            <svg
              className="w-3 h-3 opacity-70"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </p>
      </footer>

      {/* ── Floating add button ───────────────────────────────────── */}
      {/* Positioned above the iOS home indicator via safe-area-inset-bottom */}
      {!readOnly && user && (
        <button
          onClick={onAddReview}
          className="fixed right-4 z-30 w-14 h-14 rounded-full bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-white shadow-elevated flex items-center justify-center text-2xl transition-all duration-150 hover:scale-105 active:scale-95"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          aria-label="Add review"
        >
          +
        </button>
      )}

      {/* ── Profile modal ─────────────────────────────────────────── */}
      {showProfileModal && (
        <ProfileModal
          auth={auth}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* ── Notification settings modal ─────────────────────────────── */}
      {showNotifSettings && (
        <NotificationSettings
          notifications={notificationsHook}
          onClose={() => setShowNotifSettings(false)}
        />
      )}
    </div>
  )
}
