import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Home from './pages/Home'
import Register from './pages/Register'
import PendingApproval from './pages/PendingApproval'
import AdminDashboard from './pages/AdminDashboard'

function StatusScreen({ title, message, onSignOut }: { title: string; message: string; onSignOut: () => void }) {
  return (
    <div className="min-h-dvh bg-warmgray-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-100 opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-warmgray-300 opacity-50 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm text-center animate-fade-in">
        <div className="w-16 h-16 rounded-3xl bg-warmgray-200 flex items-center justify-center shadow-soft mb-5 text-3xl mx-auto">
          🍗
        </div>
        <h2 className="font-display text-2xl text-charcoal-800 mb-3">{title}</h2>
        <p className="text-sm text-charcoal-400 leading-relaxed mb-8">{message}</p>
        <button onClick={onSignOut} className="btn-secondary">Sign out</button>
      </div>
    </div>
  )
}

export default function App() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return (
      <div className="min-h-dvh bg-warmgray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
          <p className="text-sm text-charcoal-400 font-medium">Loading…</p>
        </div>
      </div>
    )
  }

  const isPublic = auth.siteSettings?.is_public ?? false

  return (
    <>
      <Toaster
        position="top-center"
        gutter={8}
        containerStyle={{ top: 20 }}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#fff',
            color: '#3d2b1a',
            borderRadius: '16px',
            boxShadow: '0 8px 40px 0 rgba(154, 122, 92, 0.16)',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
          },
          success: {
            iconTheme: { primary: '#f59e0b', secondary: '#fff' },
          },
        }}
      />

      <Routes>
        <Route path="/login" element={
          auth.status === 'unauthenticated' ? (
            <Login
              onSignInGoogle={auth.signInWithGoogle}
              onSignInEmail={auth.signInWithEmail}
              isPublic={isPublic}
              onBrowse={isPublic ? () => window.history.back() : undefined}
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
                />
              )
            ) : auth.status === 'pending' ? (
              <PendingApproval auth={auth} />
            ) : auth.status === 'rejected' ? (
              <StatusScreen
                title="Access not approved"
                onSignOut={auth.signOut}
                message="Your access request was not approved. Contact an admin if you think this is a mistake."
              />
            ) : auth.status === 'disabled' ? (
              <StatusScreen
                title="Account disabled"
                onSignOut={auth.signOut}
                message="Your account has been disabled. Contact an admin for more information."
              />
            ) : (
              <Home auth={auth} />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
