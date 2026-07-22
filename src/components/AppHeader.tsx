import { ReactNode, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthContext } from './AuthProvider'
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
  /** When provided, renders the Feed/Spots/Map view toggle in the centre.
   *  Only Home passes these; the new pages omit them. */
  view?: View
  onViewChange?: (v: View) => void
}

function ViewIcon({ kind, className = 'w-4 h-4' }: { kind: View; className?: string }) {
  if (kind === 'gallery') {
    // Grid/feed
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    )
  }
  if (kind === 'list') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <circle cx="3.5" cy="6" r="1.2" />
        <circle cx="3.5" cy="12" r="1.2" />
        <circle cx="3.5" cy="18" r="1.2" />
      </svg>
    )
  }
  // Map pin
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'gallery', label: 'Feed' },
  { key: 'list',    label: 'Spots' },
  { key: 'map',     label: 'Map' },
]

export default function AppHeader({ view, onViewChange }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuthContext()
  const isHome = location.pathname === '/'

  const handleBack = () => {
    // Use history if there's somewhere to go back to within this session,
    // otherwise fall back to the home feed.
    if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }
  const [profileOpen, setProfileOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showNotifSettings, setShowNotifSettings] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const notificationsHook = useNotifications(auth?.user?.id)
  const [activeEvent, setActiveEvent] = useState<WingEvent | null>(null)
  const profileTriggerRef = useRef<HTMLButtonElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // Close profile menu on Escape; restore focus to the trigger.
  useEffect(() => {
    if (!profileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false)
        profileTriggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [profileOpen])

  // Focus the first menuitem when the menu opens (keyboard users).
  useEffect(() => {
    if (!profileOpen) return
    requestAnimationFrame(() => {
      const first = profileMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      first?.focus()
    })
  }, [profileOpen])

  useEffect(() => {
    if (!auth?.user) { setActiveEvent(null); return }
    let cancelled = false
    const fetchActive = async () => {
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('events_with_counts')
        .select('*')
        .eq('is_published', true)
        .or(`ends_at.gte.${now},ends_at.is.null`)
        .order('starts_at', { ascending: true, nullsFirst: false })
        .limit(1)
      if (cancelled) return
      if (error) {
        // Fail quietly: the broadcast strip is optional chrome — just don't
        // render it rather than showing a bogus "no event" state elsewhere.
        setActiveEvent(null)
        return
      }
      setActiveEvent((data?.[0] as WingEvent | undefined) ?? null)
    }
    fetchActive()
    return () => { cancelled = true }
  }, [auth?.user])

  useHistoryModal(showProfileModal, () => setShowProfileModal(false))
  useHistoryModal(showNotifSettings, () => setShowNotifSettings(false))

  const user = auth?.user
  const profile = auth?.profile
  const avatar = profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined)
  const name = profile?.display_name ?? profile?.full_name
    ?? (user?.user_metadata?.full_name as string | undefined)
    ?? user?.email ?? ''
  const email = user?.email ?? ''

  const eventLabel = activeEvent && activeEvent.starts_at && new Date(activeEvent.starts_at) > new Date()
    ? 'Upcoming crawl'
    : 'Crawl in progress'

  function handleBrandClick() {
    if (onViewChange) onViewChange('gallery')
    else navigate('/')
  }

  return (
    <>
      <header
        className="sticky top-0 z-40 bg-night-900 text-cream-50 border-b-2 border-night-900 relative grain-overlay"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="pointer-events-none absolute inset-0 bg-halftone-dark opacity-25" aria-hidden="true" />

        <div className="relative max-w-2xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Back button — visible on non-home routes for predictable navigation */}
          {!isHome && (
            <button
              onClick={handleBack}
              aria-label="Back"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-cream-100 hover:text-cream-50 hover:bg-night-800 active:bg-night-700 transition-colors -ml-1"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Brand — shrinks if the toggle + actions need more space */}
          <button
            onClick={handleBrandClick}
            className="flex items-center gap-2 min-w-0 flex-shrink group"
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

          {/* View toggle — only when caller provided one */}
          {view && onViewChange && (
            <div className="flex items-center gap-0.5 bg-night-800 rounded-full p-1 border-2 border-night-900 flex-shrink-0" role="tablist" aria-label="View">
              {VIEWS.map(({ key, label }) => {
                const active = view === key
                return (
                  <button
                    key={key}
                    role="tab"
                    onClick={() => onViewChange(key)}
                    aria-label={label}
                    aria-selected={active}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-crowd transition-all
                      ${active
                        ? 'bg-cream-50 text-night-900 shadow-sticker-sm'
                        : 'text-cream-100/85 hover:text-cream-50'}`}
                  >
                    <ViewIcon kind={key} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Notifications + Profile */}
          {user ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <NotificationBell notifications={notificationsHook} />
              <div className="relative">
                <button
                  ref={profileTriggerRef}
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-10 h-10 rounded-full overflow-hidden border-2 border-cream-50
                             hover:border-sauce-300 transition-colors
                             flex items-center justify-center bg-night-700 shadow-sticker-sm"
                  aria-label="Profile menu"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                >
                  {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-extrabold uppercase text-cream-50">
                      {(name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>

                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileOpen(false)}
                    />
                    <div
                      ref={profileMenuRef}
                      role="menu"
                      aria-label="Account"
                      className="absolute right-0 top-full mt-2 w-[min(15rem,calc(100vw-1rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto bg-cream-50 rounded-xl border-2 border-night-900 shadow-sticker z-50 animate-slide-up text-night-800"
                    >
                      <div className="px-4 py-3 border-b-2 border-night-900 bg-cream-100">
                        <p className="text-sm font-bold text-night-900 truncate">{name}</p>
                        <p className="text-[11px] text-charcoal-500 truncate mt-0.5">{email}</p>
                        {auth?.isAdmin && (
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
                        Crawls
                      </MenuItem>

                      <MenuItem onClick={() => { setProfileOpen(false); navigate('/lists/new') }}>
                        + New list
                      </MenuItem>

                      <MenuItem onClick={() => { setProfileOpen(false); setShowNotifSettings(true) }}>
                        Notification settings
                      </MenuItem>

                      {auth?.isAdmin && (
                        <MenuItem onClick={() => { setProfileOpen(false); navigate('/admin') }}>
                          Admin dashboard
                        </MenuItem>
                      )}

                      <MenuItem onClick={async () => { setProfileOpen(false); await auth?.signOut() }} danger>
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

      {/* Active event broadcast strip */}
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

      {/* Modals owned by the header */}
      {showProfileModal && auth && (
        <ProfileModal
          auth={auth}
          onClose={() => setShowProfileModal(false)}
        />
      )}
      {showLeaderboard && (
        <LeaderboardModal
          currentUserId={user?.id ?? ''}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {showNotifSettings && (
        <NotificationSettings
          notifications={notificationsHook}
          onClose={() => setShowNotifSettings(false)}
        />
      )}
    </>
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
  const base = 'w-full px-4 py-3 text-left text-sm font-bold border-t border-night-900/15 transition-colors focus:outline-none focus:bg-cream-100'
  const tone = danger
    ? 'text-sauce-600 hover:bg-sauce-50 active:bg-sauce-100'
    : accent
      ? 'text-night-900 hover:bg-cream-100 active:bg-cream-200'
      : 'text-night-800 hover:bg-cream-100 active:bg-cream-200'
  return (
    <button role="menuitem" onClick={onClick} className={`${base} ${tone}`}>
      {children}
    </button>
  )
}
