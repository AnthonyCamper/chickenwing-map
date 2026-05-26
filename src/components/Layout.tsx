import { ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthState } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { useHistoryModal } from '../hooks/useHistoryModal'
import { supabase } from '../lib/supabase'
import type { WingEvent } from '../lib/types'
import ProfileModal from './ProfileModal'
import LeaderboardModal from './LeaderboardModal'
import NotificationBell from './NotificationBell'
import NotificationSettings from './NotificationSettings'

type View = 'list' | 'map' | 'gallery'

interface Props {
  auth: AuthState
  view: View
  onViewChange: (v: View) => void
  onAddReview: () => void
  readOnly?: boolean
  liveScene?: ReactNode
  children: ReactNode
}

const VIEWS: { key: View; label: string; short: string }[] = [
  { key: 'gallery', label: 'Feed',   short: 'F' },
  { key: 'list',    label: 'Spots',  short: 'S' },
  { key: 'map',     label: 'Map',    short: 'M' },
]

export default function Layout({
  auth, view, onViewChange, onAddReview, readOnly = false, liveScene, children,
}: Props) {
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showNotifSettings, setShowNotifSettings] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const notificationsHook = useNotifications(auth.user?.id)
  const [activeEvent, setActiveEvent] = useState<WingEvent | null>(null)

  // Load the currently-active published event (upcoming, fallback to most recent)
  useEffect(() => {
    if (!auth.user) { setActiveEvent(null); return }
    let cancelled = false
    const fetchActive = async () => {
      const now = new Date().toISOString()
      const { data } = await supabase
        .from('events_with_counts')
        .select('*')
        .eq('is_published', true)
        .or(`ends_at.gte.${now},ends_at.is.null`)
        .order('starts_at', { ascending: true, nullsFirst: false })
        .limit(1)
      if (!cancelled) setActiveEvent((data?.[0] as WingEvent | undefined) ?? null)
    }
    fetchActive()
    return () => { cancelled = true }
  }, [auth.user])

  useHistoryModal(showProfileModal, () => setShowProfileModal(false))
  useHistoryModal(showNotifSettings, () => setShowNotifSettings(false))

  const user = auth.user
  const profile = auth.profile
  const avatar = profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined)
  const name = profile?.display_name ?? profile?.full_name
    ?? (user?.user_metadata?.full_name as string | undefined)
    ?? user?.email ?? ''
  const email = user?.email ?? ''

  const eventLabel = activeEvent && activeEvent.starts_at && new Date(activeEvent.starts_at) > new Date()
    ? 'Upcoming crawl'
    : 'Crawl in progress'

  return (
    <div className="min-h-dvh flex flex-col bg-cream-50">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 bg-night-900 text-cream-50 border-b-2 border-night-900 relative grain-overlay"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Halftone wash */}
        <div className="pointer-events-none absolute inset-0 bg-halftone-dark opacity-25" aria-hidden="true" />

        <div className="relative max-w-2xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Brand — sticker mark + condensed wordmark */}
          <button
            onClick={() => onViewChange('gallery')}
            className="flex items-center gap-2 min-w-0 flex-shrink-0 group"
            aria-label="Home"
          >
            <span className="relative inline-flex">
              <img
                src="/favicon.svg"
                alt=""
                className="w-9 h-9 rounded-lg border-2 border-cream-50 shadow-sticker-sm
                           group-hover:rotate-[-4deg] transition-transform"
              />
            </span>
            <span className="flex flex-col items-start leading-none min-w-0">
              <span className="font-display uppercase text-lg sm:text-2xl tracking-tightest text-cream-50 truncate">
                WingKingTony
              </span>
              <span className="hidden sm:inline text-[9px] uppercase tracking-crowd text-sauce-300 mt-0.5">
                Ate it. Rated it. Let the people know.
              </span>
            </span>
          </button>

          {/* View toggle — uppercase chips on a black pill */}
          <div className="flex items-center gap-0.5 bg-night-800 rounded-full p-1 border-2 border-night-900 flex-shrink-0">
            {VIEWS.map(({ key, label, short }) => {
              const active = view === key
              return (
                <button
                  key={key}
                  onClick={() => onViewChange(key)}
                  aria-label={label}
                  aria-pressed={active}
                  className={`px-3 sm:px-3.5 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-crowd transition-all
                    ${active
                      ? 'bg-cream-50 text-night-900 shadow-sticker-sm'
                      : 'text-cream-200/70 hover:text-cream-50'}`}
                >
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              )
            })}
          </div>

          {/* Notifications + Profile */}
          {user ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <NotificationBell notifications={notificationsHook} />
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-cream-50
                             hover:border-sauce-300 transition-colors
                             flex items-center justify-center bg-night-700 shadow-sticker-sm"
                  aria-label="Profile menu"
                >
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-extrabold uppercase text-cream-50">
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
                    <div className="absolute right-0 top-full mt-2 w-60 bg-cream-50 rounded-xl border-2 border-night-900 shadow-sticker overflow-hidden z-50 animate-slide-up text-night-800">
                      <div className="px-4 py-3 border-b-2 border-night-900 bg-cream-100">
                        <p className="text-sm font-bold text-night-900 truncate">{name}</p>
                        <p className="text-[11px] text-charcoal-500 truncate mt-0.5">{email}</p>
                        {auth.isAdmin && (
                          <span className="mt-1.5 inline-block sticker-night text-[9px]">
                            Admin
                          </span>
                        )}
                      </div>

                      <MenuItem onClick={() => { setProfileOpen(false); setShowProfileModal(true) }}>
                        Profile
                      </MenuItem>

                      {activeEvent && (
                        <MenuItem onClick={() => { setProfileOpen(false); navigate(`/events/${activeEvent.slug}`) }} accent>
                          <span className="text-sauce-500 font-extrabold uppercase tracking-crowd text-[10px] block">{eventLabel}</span>
                          <span className="block truncate">{activeEvent.name} →</span>
                        </MenuItem>
                      )}

                      <MenuItem onClick={() => { setProfileOpen(false); setShowLeaderboard(true) }}>
                        🏆 The board
                      </MenuItem>

                      <MenuItem onClick={() => { setProfileOpen(false); navigate('/events') }}>
                        All crawls
                      </MenuItem>

                      <MenuItem onClick={() => { setProfileOpen(false); setShowNotifSettings(true) }}>
                        Notification settings
                      </MenuItem>

                      {auth.isAdmin && (
                        <MenuItem onClick={() => { setProfileOpen(false); navigate('/admin') }}>
                          Admin dashboard
                        </MenuItem>
                      )}

                      <MenuItem onClick={async () => { setProfileOpen(false); await auth.signOut() }} danger>
                        Sign out
                      </MenuItem>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="bg-sauce-400 text-cream-50 border-2 border-cream-50 px-3 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-crowd shadow-sticker-sm hover:bg-sauce-300 transition-colors flex-shrink-0"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* ── Active event broadcast strip ───────────────────────────── */}
      {activeEvent && (
        <button
          onClick={() => navigate(`/events/${activeEvent.slug}`)}
          className="relative w-full bg-sauce-500 text-cream-50 hover:bg-sauce-400 active:bg-sauce-600 transition-colors border-b-2 border-night-900 group overflow-hidden"
          aria-label={`${eventLabel}: ${activeEvent.name}`}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 stripe-band opacity-90" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 stripe-band opacity-90" aria-hidden="true" />
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-center gap-3 text-left">
            <span className="text-base flex-shrink-0">📣</span>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <span className="text-[10px] font-extrabold uppercase tracking-crowd opacity-90 leading-none">
                {eventLabel} —
              </span>{' '}
              <span className="text-sm font-extrabold uppercase tracking-tightest truncate inline-block align-middle max-w-[60vw]">
                {activeEvent.name}
              </span>
            </div>
            <span className="hidden sm:inline text-[11px] font-extrabold uppercase tracking-crowd flex-shrink-0 group-hover:translate-x-0.5 transition-transform">
              Pull up →
            </span>
          </div>
        </button>
      )}

      {/* ── Live scene marquee slot ─────────────────────────────────── */}
      {liveScene}

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 relative">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="relative border-t-2 border-night-900 bg-night-900 text-cream-100 px-4 py-6 text-center grain-overlay"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <p className="font-display uppercase tracking-tightest text-2xl text-cream-50 leading-none">
          Wing culture lives here
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-crowd text-cream-100/60">
          A WingKingTony joint
          <span aria-hidden="true" className="mx-2 text-sauce-400">·</span>
          <a
            href="https://winkingtony.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-sauce-300 hover:text-sauce-200 inline-flex items-center gap-0.5"
          >
            Winking Tony
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
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

      {/* ── Floating add button — "RATE" sticker action ──────────── */}
      {!readOnly && user && (
        <button
          onClick={onAddReview}
          className="fixed right-4 z-30 group flex items-center gap-2
                     bg-sauce-400 text-cream-50 border-2 border-night-900
                     px-4 h-14 rounded-full shadow-sticker
                     hover:bg-sauce-300 hover:shadow-sticker-sauce
                     active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                     transition-all"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          aria-label="Drop a rating"
        >
          <span className="text-2xl font-extrabold leading-none">+</span>
          <span className="hidden sm:inline text-xs font-extrabold uppercase tracking-crowd">
            Drop a take
          </span>
        </button>
      )}

      {/* ── Profile modal ─────────────────────────────────────────── */}
      {showProfileModal && (
        <ProfileModal
          auth={auth}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* ── Leaderboard modal ─────────────────────────────────────── */}
      {showLeaderboard && (
        <LeaderboardModal
          currentUserId={user?.id ?? ''}
          onClose={() => setShowLeaderboard(false)}
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

function MenuItem({
  children, onClick, accent, danger,
}: {
  children: ReactNode
  onClick: () => void
  accent?: boolean
  danger?: boolean
}) {
  const base = 'w-full px-4 py-3 text-left text-sm font-bold border-t border-night-900/15 transition-colors'
  const tone = danger
    ? 'text-sauce-600 hover:bg-sauce-50 active:bg-sauce-100'
    : accent
      ? 'text-night-900 hover:bg-cream-100 active:bg-cream-200'
      : 'text-night-800 hover:bg-cream-100 active:bg-cream-200'
  return (
    <button onClick={onClick} className={`${base} ${tone}`}>
      {children}
    </button>
  )
}
