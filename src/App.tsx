import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Home from './pages/Home'
import Register from './pages/Register'
import PendingApproval from './pages/PendingApproval'
import SpotPage from './pages/SpotPage'
import UserProfilePage from './pages/UserProfilePage'
import ReviewPage from './pages/ReviewPage'
import CrawlPage from './pages/CrawlPage'
import { AuthGateProvider } from './components/AuthGateModal'
import { AuthProvider } from './components/AuthProvider'

// ── Lazy-loaded routes — off the main path / heavy deps ──────────────────
// AdminDashboard / EventPage / EventsIndex: admin or event-specific paths
// CrawlEditor: pulls in @dnd-kit + the cover-upload pipeline; only owners hit it
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const EventPage = lazy(() => import('./pages/EventPage'))
const EventsIndex = lazy(() => import('./pages/EventsIndex'))
const CrawlEditor = lazy(() => import('./pages/CrawlEditor'))

function LazyFallback() {
  return (
    <div className="min-h-dvh bg-paper flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
    </div>
  )
}

const ADMIN_EMAIL = 'anthonycap949@gmail.com'

function StatusScreen({ title, message, onSignOut }: { title: string; message: string; onSignOut: () => void }) {
  return (
    <div className="relative min-h-dvh bg-paper flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Decorative splatter */}
      <div className="pointer-events-none fixed -top-12 -right-8 w-[420px] h-[280px] bg-splatter opacity-25" />
      <div className="pointer-events-none fixed -bottom-12 -left-12 w-[420px] h-[280px] bg-splatter opacity-20 rotate-180" />

      <div className="relative w-full max-w-sm text-center animate-fade-in">
        <div className="inline-flex items-center justify-center mb-6">
          <img src="/favicon.svg" alt="" className="w-20 h-20 rounded-2xl border-2 border-night-900 shadow-sticker" />
        </div>
        <p className="eyebrow mb-3">House rules</p>
        <h2 className="font-display uppercase text-4xl text-night-900 mb-3 tracking-tightest leading-none">{title}</h2>
        <p className="text-sm text-charcoal-600 leading-relaxed mb-6">{message}</p>
        <div className="flex flex-col items-center gap-2">
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(`WingMap — ${title}`)}`}
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
  const auth = useAuth()
  const navigate = useNavigate()

  if (auth.status === 'loading') {
    return (
      <div className="relative min-h-dvh bg-paper-dark flex items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-halftone-dark opacity-20" />
        <div className="relative flex flex-col items-center gap-5">
          <div className="w-14 h-14 rounded-full border-4 border-night-700 border-t-sauce-400 animate-spin" />
          <p className="font-display uppercase tracking-crowd text-cream-100 text-sm">Firing up the fryer…</p>
        </div>
      </div>
    )
  }

  const isPublic = auth.siteSettings?.is_public ?? false
  const isAuthenticated = auth.status === 'authorized'

  return (
    <AuthProvider auth={auth}>
    <AuthGateProvider isAuthenticated={isAuthenticated} onSignInGoogle={auth.signInWithGoogle}>
      <Toaster
        position="top-center"
        gutter={8}
        containerStyle={{ top: 20 }}
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
            <Navigate to="/" replace />
          )
        } />

        <Route path="/register" element={
          auth.status === 'unauthenticated' ? (
            <Register onSignUp={auth.signUpWithEmail} />
          ) : (
            <Navigate to="/" replace />
          )
        } />

        <Route path="/admin" element={
          auth.status === 'authorized' && auth.isAdmin ? (
            <AdminDashboard />
          ) : (
            <Navigate to="/" replace />
          )
        } />

        <Route path="/events" element={
          auth.status === 'authorized' ? (
            <EventsIndex />
          ) : auth.status === 'pending' ? (
            <PendingApproval auth={auth} />
          ) : (
            <Navigate to="/login" replace />
          )
        } />

        <Route path="/events/:slug" element={
          auth.status === 'authorized' ? (
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

        <Route path="/spots/:slug" element={<SpotPage />} />
        <Route path="/u/:username" element={<UserProfilePage />} />
        <Route path="/reviews/:id" element={<ReviewPage />} />
        <Route path="/lists/:slug" element={<CrawlPage />} />
        <Route path="/lists/new" element={<CrawlEditor />} />
        <Route path="/lists/:id/edit" element={<CrawlEditor />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </AuthGateProvider>
    </AuthProvider>
  )
}
