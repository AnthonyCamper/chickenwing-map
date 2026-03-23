import { useState } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  onSignInGoogle: () => Promise<void>
  onSignInEmail: (email: string, password: string) => Promise<{ error: string | null }>
  isPublic: boolean
  onBrowse?: () => void
}

export default function Login({ onSignInGoogle, onSignInEmail, isPublic, onBrowse }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await onSignInGoogle()
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setError(null)
    setEmailLoading(true)
    const result = await onSignInEmail(email, password)
    if (result.error) {
      setError(result.error)
      setEmailLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-warmgray-50 flex flex-col items-center justify-center px-6 py-12">
      {/* Decorative background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-100 opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-warmgray-300 opacity-50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo / brand mark */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-amber-400 flex items-center justify-center shadow-elevated mb-5 text-3xl">
            🍗
          </div>
          <h1 className="font-display text-3xl text-charcoal-800 tracking-tight">
            WingMap
          </h1>
          <p className="mt-2 text-sm text-charcoal-400 text-center leading-relaxed">
            Your spot for rating the best chicken wings around.
          </p>
        </div>

        {/* Sign-in card */}
        <div className="card px-8 py-8 space-y-5">
          <p className="text-center text-xs uppercase tracking-widest font-semibold text-charcoal-400">
            Sign in to continue
          </p>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading || emailLoading}
            className="btn-primary w-full gap-3 py-3.5 text-base"
          >
            {googleLoading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white border-t-amber-200 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-warmgray-200" />
            <span className="text-xs text-charcoal-300 font-medium">or</span>
            <div className="flex-1 h-px bg-warmgray-200" />
          </div>

          {/* Email / password */}
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
                disabled={emailLoading || googleLoading}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                autoComplete="current-password"
                disabled={emailLoading || googleLoading}
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={emailLoading || googleLoading || !email || !password}
              className="btn-secondary w-full py-3"
            >
              {emailLoading ? (
                <span className="w-4 h-4 rounded-full border-2 border-charcoal-400 border-t-transparent animate-spin" />
              ) : null}
              {emailLoading ? 'Signing in…' : 'Sign in with email'}
            </button>
          </form>

          <p className="text-center text-xs text-charcoal-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-amber-500 font-semibold hover:underline">
              Request access
            </Link>
          </p>

          {isPublic && onBrowse && (
            <button
              onClick={onBrowse}
              className="w-full text-xs text-charcoal-400 hover:text-charcoal-600 transition-colors py-1"
            >
              Browse without signing in →
            </button>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-charcoal-300">
          WingMap
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="rgba(255,255,255,0.9)"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="rgba(255,255,255,0.9)"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="rgba(255,255,255,0.9)"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="rgba(255,255,255,0.9)"/>
    </svg>
  )
}
