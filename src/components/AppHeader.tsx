import { ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthContext } from './AuthProvider'
import { useNotifications } from '../hooks/useNotifications'
import { useHistoryModal } from '../hooks/useHistoryModal'
import { supabase } from '../lib/supabase'
import { lazyWithReload } from '../lib/staleDeploy'
import type { WingEvent } from '../lib/types'
import NotificationBell from './NotificationBell'
import AvatarImage from './ui/AvatarImage'

// Opened from the profile menu only, and the header ships on every page:
// keep them out of the first-load bundle.
// lazyWithReload: reloads onto the new version if a deploy removed the file.
const ProfileModal = lazyWithReload(() => import('./ProfileModal'))
const LeaderboardModal = lazyWithReload(() => import('./LeaderboardModal'))
const NotificationSettings = lazyWithReload(() => import('./NotificationSettings'))

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

// Same inbox as the footer's Contact link.
const CONTACT_EMAIL = 'anthonycap949@gmail.com'

// ── Active event, shared by every mounted header ────────────────────────────
const ACTIVE_EVENT_TTL_MS = 5 * 60_000
let cachedActiveEvent: { event: WingEvent | null; at: number } | null = null
let activeEventRequest: Promise<WingEvent | null> | null = null

function loadActiveEvent(): Promise<WingEvent | null> {
  if (cachedActiveEvent && Date.now() - cachedActiveEvent.at < ACTIVE_EVENT_TTL_MS) {
    return Promise.resolve(cachedActiveEvent.event)
  }
  if (activeEventRequest) return activeEventRequest
  const now = new Date().toISOString()
  activeEventRequest = Promise.resolve(
    supabase
      .from('events_with_counts')
      .select('*')
      .eq('is_published', true)
      .or(`ends_at.gte.${now},ends_at.is.null`)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .limit(1),
  ).then(({ data, error }) => {
    // Fail quietly: the broadcast strip is optional chrome — just don't
    // render it rather than showing a bogus "no event" state elsewhere
    // (and don't cache the failure, so the next page tries again).
    if (error) return null
    const event = (data?.[0] as WingEvent | undefined) ?? null
    cachedActiveEvent = { event, at: Date.now() }
    return event
  }, () => null).finally(() => { activeEventRequest = null })
  return activeEventRequest
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
    // React Router stamps an index into history.state — idx > 0 means there
    // is in-app history to pop. (document.referrer never updates during SPA
    // navigation, so it wrongly sent external arrivals home forever.)
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) {
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
  const [activeEvent, setActiveEvent] = useState<WingEvent | null>(() => cachedActiveEvent?.event ?? null)
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

  // Runs signed-out too: published events are anon-readable (migration 029),
  // and the broadcast strip is the only in-app pointer to the crawl — gating
  // it on a session left logged-out visitors with no way to find the event.
  // Every page mounts its own header, so the answer is shared (see
  // loadActiveEvent) instead of refetched on each navigation.
  useEffect(() => {
    let cancelled = false
    loadActiveEvent().then(ev => { if (!cancelled) setActiveEvent(ev) })
    return () => { cancelled = true }
  }, [auth?.user?.id])

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
    ? 'Upcoming event'
    : 'Event happening now'

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

        <div className="relative max-w-2xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Back button — visible on non-home routes for predictable navigation */}
          {!isHome && (
            <button
              onClick={handleBack}
              aria-label="Back"
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg text-cream-100 hover:text-cream-50 hover:bg-night-800 active:bg-night-700 transition-colors -ml-1.5"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Brand — shrinks if the toggle + actions need more space. On a
              phone with the view tabs showing there's no room for the full
              wordmark (it clipped to "WINGKINGTON'"), so it's icon-only there. */}
          <button
            onClick={handleBrandClick}
            // With the view tabs, the brand is just the icon (and on the very
            // narrowest phones it steps aside entirely; the Feed tab goes to
            // the same place)
            className={`${view && onViewChange ? 'hidden min-[360px]:flex flex-shrink-0' : 'flex flex-shrink'} items-center gap-2 min-w-11 min-h-11 group`}
            aria-label="WingKingTony home"
          >
            <span className="relative inline-flex flex-shrink-0">
              <img
                src="/favicon.svg"
                alt=""
                className="w-9 h-9 rounded-lg border-2 border-cream-50 shadow-sticker-sm
                           group-hover:rotate-[-4deg] transition-transform"
              />
            </span>
            <span className={`${view && onViewChange ? 'hidden sm:flex' : 'flex'} flex-col items-start leading-none min-w-0`}>
              <span className="font-display uppercase text-lg sm:text-xl tracking-tightest text-cream-50 truncate max-w-full">
                WingKingTony
              </span>
              {/* Tagline only where there's room (pages without the view tabs) */}
              <span className={`${view && onViewChange ? 'hidden' : 'hidden sm:block'} text-[9px] uppercase tracking-wide text-sauce-300 mt-0.5 truncate max-w-full`}>
                Ate it. Rated it. Let the people know.
              </span>
            </span>
          </button>

          {/* View toggle — only when caller provided one */}
          {view && onViewChange && (
            <div className="flex items-center gap-0.5 bg-night-800 rounded-full p-0.5 flex-shrink-0" role="tablist" aria-label="View">
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
                    // 44px tall tap target; on phones the label sits under the
                    // icon so the tabs say what they are without widening them
                    className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 h-11 min-w-[2.75rem] px-1.5 sm:px-3 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide leading-none transition-all
                      ${active
                        ? 'bg-cream-50 text-night-900 shadow-sticker-sm'
                        : 'text-cream-100/85 hover:text-cream-50'}`}
                  >
                    <ViewIcon kind={key} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Events — public (signed-out visitors can browse crawls too) */}
          <Link
            to="/events"
            aria-label="Events"
            aria-current={location.pathname === '/events' ? 'page' : undefined}
            className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 h-11 min-w-[2.75rem] px-1 sm:px-2 rounded-lg flex-shrink-0
                       text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide leading-none
                       text-cream-100/85 hover:text-cream-50 hover:bg-night-800 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="3" x2="8" y2="7" />
              <line x1="16" y1="3" x2="16" y2="7" />
            </svg>
            {/* icon-only on very narrow phones (<370px) so the header fits */}
            <span className="hidden min-[370px]:inline">Events</span>
          </Link>

          {/* Notifications + Profile */}
          {/* `relative` on this container (not the bell wrapper) anchors the
              notification dropdown so it hugs the viewport edge instead of
              poking past it on narrow screens. */}
          {user ? (
            <div className="relative flex items-center gap-1 flex-shrink-0">
              <NotificationBell notifications={notificationsHook} />
              <div className="relative">
                {/* 44×44 tap target around the 40px avatar */}
                <button
                  ref={profileTriggerRef}
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="w-11 h-11 flex items-center justify-center rounded-full group"
                  aria-label="Profile menu"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                >
                  <span className="w-10 h-10 rounded-full overflow-hidden border-2 border-cream-50
                                   group-hover:border-sauce-300 transition-colors
                                   flex items-center justify-center bg-night-700 shadow-sticker-sm">
                    <AvatarImage
                      src={avatar}
                      alt={name}
                      className="w-full h-full object-cover"
                      fallback={
                        <span className="text-sm font-extrabold uppercase text-cream-50">
                          {(name || '?').charAt(0).toUpperCase()}
                        </span>
                      }
                    />
                  </span>
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

                      {profile?.username && (
                        <MenuItem onClick={() => { setProfileOpen(false); navigate(`/u/${profile.username}`) }}>
                          My profile
                        </MenuItem>
                      )}

                      <MenuItem onClick={() => { setProfileOpen(false); setShowProfileModal(true) }}>
                        Edit profile
                      </MenuItem>

                      {activeEvent && (
                        <MenuItem onClick={() => { setProfileOpen(false); navigate(`/events/${activeEvent.slug}`) }} accent>
                          <span className="text-sauce-500 font-extrabold uppercase tracking-crowd text-[10px] block">{eventLabel}</span>
                          <span className="block truncate">{activeEvent.name} →</span>
                        </MenuItem>
                      )}

                      <MenuItem onClick={() => { setProfileOpen(false); setShowLeaderboard(true) }}>
                        🏆 Leaderboard
                      </MenuItem>

                      <MenuItem onClick={() => { setProfileOpen(false); navigate('/?tab=crawls') }}>
                        Lists
                      </MenuItem>

                      <MenuItem onClick={() => { setProfileOpen(false); navigate('/lists/new') }}>
                        + Create a list
                      </MenuItem>

                      <MenuItem onClick={() => { setProfileOpen(false); setShowNotifSettings(true) }}>
                        Notification settings
                      </MenuItem>

                      {auth?.isAdmin && (
                        <MenuItem onClick={() => { setProfileOpen(false); navigate('/admin') }}>
                          Admin dashboard
                        </MenuItem>
                      )}

                      {/* Site info — otherwise only in the feed's footer,
                          thousands of pixels down */}
                      <div className="flex border-t border-night-900/15">
                        <MenuLink to="/privacy" onClick={() => setProfileOpen(false)}>Privacy</MenuLink>
                        <MenuLink to="/terms" onClick={() => setProfileOpen(false)}>Terms</MenuLink>
                        <MenuLink href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('WingKingTony')}`} onClick={() => setProfileOpen(false)}>
                          Contact
                        </MenuLink>
                      </div>

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
              className="bg-sauce-400 text-cream-50 border-2 border-cream-50 px-3 min-h-11 rounded-lg text-[11px] font-extrabold uppercase tracking-wide sm:tracking-crowd whitespace-nowrap shadow-sticker-sm hover:bg-sauce-300 transition-colors flex-shrink-0"
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Active event broadcast strip — pointless on the event's own page */}
      {activeEvent && location.pathname !== `/events/${activeEvent.slug}` && (
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
              See event →
            </span>
          </div>
        </button>
      )}

      {/* Modals owned by the header (lazy — fallback null: they open over
          the page, so a blank frame while the chunk loads is fine) */}
      <Suspense fallback={null}>
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
      </Suspense>
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

/** Compact link row item for Privacy / Terms / Contact in the profile menu. */
function MenuLink({
  children, to, href, onClick,
}: {
  children: ReactNode
  to?: string
  href?: string
  onClick: () => void
}) {
  const cls = 'flex-1 min-h-11 px-2 flex items-center justify-center text-xs font-bold text-charcoal-600 underline underline-offset-2 decoration-night-900/20 hover:bg-cream-100 hover:text-night-900 focus:outline-none focus:bg-cream-100'
  return to ? (
    <Link role="menuitem" to={to} onClick={onClick} className={cls}>{children}</Link>
  ) : (
    <a role="menuitem" href={href} onClick={onClick} className={cls}>{children}</a>
  )
}
