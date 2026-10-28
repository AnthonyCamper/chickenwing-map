import { Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { usePushDeepLinks } from './hooks/usePushDeepLinks'
import toast, { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import ErrorBoundary from './components/ErrorBoundary'
import PageStateShell from './components/ui/PageStateShell'
import AppHeader from './components/AppHeader'
import { AuthGateProvider } from './components/AuthGateModal'
import { AuthProvider } from './components/AuthProvider'
import LazyBadgeUnlockOverlay, { prefetchBadgeUnlockOverlay } from './components/LazyBadgeUnlockOverlay'
import { DefaultTitle, ScrollToTop, SiteFooter } from './components/RouteChrome'
import { clearReturnTo, dropReturnToOnFreshAuthLoad, isAuthPath, peekReturnTo, takeReturnTo } from './lib/authReturn'
import { lazyWithReload } from './lib/staleDeploy'
import { prefetchWhenIdle } from './lib/idlePrefetch'

// ── Lazy-loaded routes — off the main path / heavy deps ──────────────────
// AdminDashboard / EventPage / EventsIndex: admin or event-specific paths
// CrawlEditor: pulls in @dnd-kit + the cover-upload pipeline; only owners hit it
// lazyWithReload: a tab left open across a deploy asks for chunk files that
// no longer exist; it reloads once onto the new version instead of crashing
// into "Something broke" (see lib/staleDeploy).
const AdminDashboard = lazyWithReload(() => import('./pages/AdminDashboard'))
const EventPage = lazyWithReload(() => import('./pages/EventPage'))
const loadEventsIndex = () => import('./pages/EventsIndex')
const EventsIndex = lazyWithReload(loadEventsIndex)
const CrawlEditor = lazyWithReload(() => import('./pages/CrawlEditor'))
const ResetPassword = lazyWithReload(() => import('./pages/ResetPassword'))
const Privacy = lazyWithReload(() => import('./pages/Privacy'))
const Terms = lazyWithReload(() => import('./pages/Terms'))
// Content pages and the sign-up/pending screens aren't on the landing path
// either; keeping them out of the first bundle matters on slow 3G.
const loadRegister = () => import('./pages/Register')
const Register = lazyWithReload(loadRegister)
// Sign-in isn't on the public landing path either (S26: it and Register,
// which it imports, were ~30 KB of the first download). On a private site
// "/" is the sign-in screen, and its code is requested as soon as the
// session check says "signed out".
const loadLogin = () => import('./pages/Login')
const Login = lazyWithReload(loadLogin)
const PendingApproval = lazyWithReload(() => import('./pages/PendingApproval'))
const loadSpotPage = () => import('./pages/SpotPage')
const SpotPage = lazyWithReload(loadSpotPage)
const loadUserProfilePage = () => import('./pages/UserProfilePage')
const UserProfilePage = lazyWithReload(loadUserProfilePage)
const loadReviewPage = () => import('./pages/ReviewPage')
const ReviewPage = lazyWithReload(loadReviewPage)
const loadCrawlPage = () => import('./pages/CrawlPage')
const CrawlPage = lazyWithReload(loadCrawlPage)

// Fetched in the background once the first page is idle, most likely next
// tap first: a feed card's spot or review, the Spots tab, a reviewer's
// profile, a list, Events. (Login/Register are warmed separately below, for
// signed-out visitors only.)
// The Map tab (Leaflet) is left out: it's big, and would compete with feed
// photos on a slow connection.
const LIKELY_NEXT_PAGES = [
  loadSpotPage,
  loadReviewPage,
  () => import('./components/ListView'),
  loadUserProfilePage,
  loadCrawlPage,
  loadEventsIndex,
]

// Shown while a lazy page's code downloads (3–5s on slow 3G). The real app
// header plus a page-shaped skeleton (title, a couple of content blocks) in
// the space the page will fill, instead of a bare centred spinner.
function LazyFallback() {
  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      <AppHeader />
      <div role="status" className="w-full max-w-2xl mx-auto px-4 py-6 space-y-4 animate-pulse" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div aria-hidden="true" className="h-3 w-24 rounded bg-night-900/10" />
        <div aria-hidden="true" className="h-8 w-3/4 rounded-lg bg-night-900/10" />
        <div aria-hidden="true" className="h-4 w-1/2 rounded bg-night-900/10" />
        <div aria-hidden="true" className="h-44 rounded-2xl bg-night-900/10" />
        <div aria-hidden="true" className="h-24 rounded-2xl bg-night-900/10" />
        <div aria-hidden="true" className="h-24 rounded-2xl bg-night-900/10" />
      </div>
    </div>
  )
}

type HomeView = 'list' | 'map' | 'gallery'

// While the session/profile check runs (a couple of round trips: seconds on
// slow 3G), show the real header and a "Loading…" line instead of a
// full-screen splash. On the home page the header gets its Feed/Spots/Map
// tabs too, so it doesn't change shape when the page arrives.
function AuthLoadingShell() {
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isHome = pathname === '/'
  const view = (searchParams.get('view') as HomeView | null) ?? 'gallery'
  const setView = (v: HomeView) => {
    const next = new URLSearchParams(searchParams)
    if (v === 'gallery') next.delete('view')
    else next.set('view', v)
    setSearchParams(next, { replace: true })
  }
  return (
    <PageStateShell headerProps={isHome ? { view, onViewChange: setView } : undefined}>
      <div role="status" className="flex flex-col items-center gap-3">
        <div aria-hidden="true" className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
        <p className="text-sm font-bold text-charcoal-600">Loading…</p>
      </div>
    </PageStateShell>
  )
}

// Height of the on-screen keyboard, as a CSS variable the bottom toasts use
// to stay above it (iOS doesn't shrink the layout viewport for the keyboard).
function useKeyboardInsetVar() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      root.style.setProperty('--wkt-kb', `${inset}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      root.style.removeProperty('--wkt-kb')
    }
  }, [])
}

// Toasts sit at the bottom centre: clear of the sticky header (logo, Events)
// and of every sheet's title and × Close at the top. They're lifted above the
// floating "Rate wings" button (Layout sets --wkt-fab-space), above an open
// sheet's pinned Cancel/Publish row (Modal sets --wkt-sheet-footer) and above
// the on-screen keyboard (--wkt-kb).
const TOASTER_BOTTOM =
  'calc(12px + max(var(--wkt-fab-space, 0px), var(--wkt-sheet-footer, 0px)) + var(--wkt-kb, 0px) + env(safe-area-inset-bottom))'

const ADMIN_EMAIL = 'anthonycap949@gmail.com'

// ProfileModal sets this right before the full reload that follows deleting
// an account. It is read once when this module loads, i.e. on the NEW page.
// Reading it in an effect let the old page (still running until the reload
// lands, seconds on a slow connection) take it and show the toast just before
// unloading, so the reloaded page never showed it (r3 breaker: gone at ~3.5s).
let accountDeletedNotice = (() => {
  try {
    const set = sessionStorage.getItem('account-deleted') === '1'
    sessionStorage.removeItem('account-deleted')
    return set
  } catch { return false }
})()

// A typed /register (or bookmark) starts a new flow: forget a return path
// left by an earlier, abandoned auth wall (S09). Once, at page load.
dropReturnToOnFreshAuthLoad()

// /login and /register end with their own Privacy · Terms · Contact footer,
// so the site footer would be a second one there (S05). /privacy, /terms and
// /reset-password have none and keep the site footer.
const OWN_FOOTER_PATHS = ['/login', '/register']
function hasOwnFooter(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  return OWN_FOOTER_PATHS.includes(path)
}

// Where /login and /register send someone once they're signed in: the page
// they were on before the auth wall, else home. Rendering the destination
// directly (rather than "/" and then a second hop from App's effect) means
// the two redirects can't race each other.
function AfterAuthRedirect() {
  const [dest] = useState(() => peekReturnTo() ?? '/')
  return <Navigate to={dest} replace />
}

function StatusScreen({ title, message, onSignOut }: { title: string; message: string; onSignOut: () => void }) {
  return (
    <div className="relative min-h-dvh bg-paper flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Decorative splatter — absolute (not fixed) so the overflow-hidden
          wrapper clips it; fixed elements escape that clip and the 420px
          width spills past narrow viewports. */}
      <div className="pointer-events-none absolute -top-12 -right-8 w-[420px] h-[280px] bg-splatter opacity-25" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 w-[420px] h-[280px] bg-splatter opacity-20 rotate-180" />

      <div className="relative w-full max-w-sm text-center animate-fade-in">
        <div className="inline-flex items-center justify-center mb-6">
          <img src="/favicon.svg" alt="" className="w-20 h-20 rounded-2xl border-2 border-night-900 shadow-sticker" />
        </div>
        <p className="eyebrow mb-3">House rules</p>
        <h2 className="font-display uppercase text-4xl text-night-900 mb-3 tracking-tightest leading-none">{title}</h2>
        <p className="text-sm text-charcoal-600 leading-relaxed mb-6">{message}</p>
        <div className="flex flex-col items-center gap-2">
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`WingKingTony — ${title}`)}`}
            className="btn-primary"
          >
            Contact admin
          </a>
          <button onClick={onSignOut} className="btn-ghost text-xs text-charcoal-500 hover:text-charcoal-700">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  usePushDeepLinks()
  const auth = useAuth()
  const navigate = useNavigate()

  const location = useLocation()
  const isPublic = auth.siteSettings?.is_public ?? false

  // Return the user to where they were headed before an auth wall (set by
  // CrawlEditor's login bounce and AuthGateModal). Survives the Google OAuth
  // full-page round-trip because it lives in sessionStorage; entries older
  // than 15 minutes are ignored (see lib/authReturn).
  // Confirmation after deleting an account (flag read at page load, below).
  useEffect(() => {
    if (auth.status === 'loading' || !accountDeletedNotice) return
    accountDeletedNotice = false
    toast.success('Your account and everything you posted were deleted.', { duration: 8000 })
  }, [auth.status])

  useEffect(() => {
    if (auth.status !== 'authorized') return
    const dest = takeReturnTo()
    if (dest) navigate(dest, { replace: true })
  }, [auth.status, navigate])

  // A signed-out visitor who wanders off to some other page has given up on
  // that sign-in, so forget it — otherwise a later, unrelated sign-up lands on
  // a page from long ago (e.g. "Start a new list"). Auth pages keep it, and so
  // does the page that set it (CrawlEditor stores it during its own mount).
  // On a private site "/" is the sign-in screen, so it keeps it too.
  useEffect(() => {
    if (auth.status !== 'unauthenticated') return
    const here = location.pathname
    if (isAuthPath(here) || (here === '/' && !isPublic)) return
    const stored = peekReturnTo()
    if (stored && stored.split('?')[0] !== here) clearReturnTo()
  }, [auth.status, location.pathname, location.search, isPublic])

  useKeyboardInsetVar()

  // Warm up the likely next pages once the first one is idle (Q25), plus
  // what this visitor needs next: the sign-in / sign-up screens when signed
  // out, the badge celebration when signed in.
  useEffect(() => { prefetchWhenIdle(LIKELY_NEXT_PAGES) }, [])
  const signedOut = auth.status === 'unauthenticated'
  const signedIn = auth.status === 'authorized'
  useEffect(() => {
    if (signedOut) prefetchWhenIdle([loadLogin, loadRegister])
    else if (signedIn) prefetchWhenIdle([prefetchBadgeUnlockOverlay])
  }, [signedOut, signedIn])

  const isAuthenticated = auth.status === 'authorized'
  // Signed-out on "/": whether that's the public feed or the sign-in screen
  // depends on site_settings, which arrives a round trip after the session
  // check. Wait for it rather than flashing the sign-in screen first.
  const settling = auth.status === 'loading'
    || (auth.status === 'unauthenticated' && location.pathname === '/' && auth.siteSettings === null)
  const showSiteFooter = !settling && location.pathname !== '/' && !hasOwnFooter(location.pathname)

  return (
    <AuthProvider auth={auth}>
    <AuthGateProvider isAuthenticated={isAuthenticated} onSignInGoogle={auth.signInWithGoogle}>
      <Toaster
        gutter={8}
        position="bottom-center"
        containerStyle={{ bottom: TOASTER_BOTTOM }}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#0d122a',
            color: '#fdfaf2',
            border: '2px solid #04050e',
            borderRadius: '12px',
            boxShadow: '4px 4px 0 0 rgba(4, 5, 14, 0.85)',
            fontSize: '13px',
            fontWeight: '600',
            letterSpacing: '0.02em',
            padding: '12px 16px',
          },
          success: {
            iconTheme: { primary: '#fa5a2e', secondary: '#fdfaf2' },
          },
          error: {
            iconTheme: { primary: '#d61f0d', secondary: '#fdfaf2' },
            style: {
              background: '#04050e',
              color: '#ffd6d0',
              border: '2px solid #d61f0d',
              borderRadius: '12px',
              boxShadow: '4px 4px 0 0 #d61f0d',
              fontSize: '13px',
              fontWeight: '600',
              letterSpacing: '0.02em',
              padding: '12px 16px',
            },
          },
        }}
      />

      <DefaultTitle />
      <ScrollToTop />

      <ErrorBoundary>
      {settling ? <AuthLoadingShell /> : (
      <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/login" element={
          auth.status === 'unauthenticated' ? (
            <Login
              onSignInGoogle={auth.signInWithGoogle}
              onSignInEmail={auth.signInWithEmail}
              isPublic={isPublic}
              onBrowse={isPublic ? () => navigate('/') : undefined}
              authError={auth.authError}
            />
          ) : (
            <AfterAuthRedirect />
          )
        } />

        <Route path="/register" element={
          auth.status === 'unauthenticated' ? (
            <Register onSignUp={auth.signUpWithEmail} isPublic={isPublic} onSignInGoogle={auth.signInWithGoogle} />
          ) : (
            <AfterAuthRedirect />
          )
        } />

        <Route path="/admin" element={
          auth.status === 'authorized' && auth.isAdmin ? (
            <AdminDashboard />
          ) : (
            <Navigate to="/" replace />
          )
        } />

        {/* Logged-out visitors get the index too — it only lists published
            events (anon-readable per 029), and bouncing them to /login was
            the dead end that hid the crawl from anyone without a share link */}
        <Route path="/events" element={
          auth.status === 'authorized' || auth.status === 'unauthenticated' ? (
            <EventsIndex />
          ) : auth.status === 'pending' ? (
            <PendingApproval auth={auth} />
          ) : (
            <Navigate to="/login" replace />
          )
        } />

        {/* Share-link preview: logged-out visitors get a read-only event page
            instead of a context-free login wall */}
        <Route path="/events/:slug" element={
          auth.status === 'authorized' || auth.status === 'unauthenticated' ? (
            <EventPage auth={auth} />
          ) : auth.status === 'pending' ? (
            <PendingApproval auth={auth} />
          ) : (
            <Navigate to="/login" replace />
          )
        } />

        <Route
          path="/"
          element={
            auth.status === 'unauthenticated' ? (
              isPublic ? (
                <Home auth={auth} readOnly />
              ) : (
                <Login
                  onSignInGoogle={auth.signInWithGoogle}
                  onSignInEmail={auth.signInWithEmail}
                  isPublic={isPublic}
                  authError={auth.authError}
                />
              )
            ) : auth.status === 'pending' ? (
              <PendingApproval auth={auth} />
            ) : auth.status === 'rejected' ? (
              <StatusScreen
                title="Access not approved"
                onSignOut={auth.signOut}
                message="Your access request was not approved. Contact the admin if you think this is a mistake."
              />
            ) : auth.status === 'disabled' ? (
              <StatusScreen
                title="Account disabled"
                onSignOut={auth.signOut}
                message="Your account has been disabled. Contact the admin for more information."
              />
            ) : (
              <Home auth={auth} />
            )
          }
        />

        {/* Reachable in any auth state: the recovery link signs the user in
            with a temporary session as it lands, so no auth gating here. */}
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        <Route path="/spots/:slug" element={<SpotPage />} />
        <Route path="/u/:username" element={<UserProfilePage />} />
        <Route path="/reviews/:id" element={<ReviewPage />} />
        <Route path="/lists/:slug" element={<CrawlPage />} />
        <Route path="/lists/new" element={<CrawlEditor />} />
        <Route path="/lists/:id/edit" element={<CrawlEditor />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      )}
      </ErrorBoundary>

      {/* Privacy / Terms / Contact on every page that doesn't use Layout
          (the home page has its own, bigger footer) */}
      {showSiteFooter && <SiteFooter />}

      {/* Celebrates badge unlocks announced after review/crawl writes */}
      <LazyBadgeUnlockOverlay />
    </AuthGateProvider>
    </AuthProvider>
  )
}
