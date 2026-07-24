import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'

interface Props {
  onSignInGoogle: () => Promise<void>
  onSignInEmail: (email: string, password: string) => Promise<{ error: string | null }>
  isPublic: boolean
  onBrowse?: () => void
  authError?: string | null
}

export default function Login({ onSignInGoogle, onSignInEmail, isPublic, onBrowse, authError }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [error, setError] = useState<string | null>(authError ?? null)

  // Forgot-password flow
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)

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

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setError(null)
    setResetSending(true)
    // BASE_URL keeps this correct if the app is ever served from a sub-path;
    // the GH-Pages 404 trick round-trips /reset-password (and the auth hash)
    // back into the SPA router.
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}reset-password`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    setResetSending(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setResetSent(true)
  }

  const exitForgotMode = () => {
    setForgotMode(false)
    setResetSent(false)
    setError(null)
  }

  return (
    <div className="relative min-h-dvh bg-cream-50 grain-overlay flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <Helmet>
        <title>Sign in — WingKingTony</title>
      </Helmet>

      {/* Splatter accents, kept faint */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.08]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.07] rotate-180" />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Brand mark */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/favicon.svg"
            alt=""
            className="w-20 h-20 -rotate-2 rounded-2xl border-2 border-night-900 shadow-sticker mb-5"
          />
          <span className="eyebrow">The wing council</span>
          <h1 className="h-poster-sm mt-1">WingKingTony</h1>
          <p className="h-hand text-xl -rotate-2 mt-1">
            ate it. rated it. let the people know.
          </p>
        </div>

        {/* Sign-in card */}
        <div className="card px-6 py-7 space-y-5">
          {forgotMode ? (
            resetSent ? (
              <div className="text-center space-y-4">
                <p className="text-3xl">📬</p>
                <p className="text-sm font-bold text-night-900 uppercase tracking-crowd">Reset link sent</p>
                <p className="text-sm text-charcoal-600 leading-relaxed break-words">
                  If <strong className="text-night-900">{email}</strong> has an account,
                  a password reset link is on the way. Check your inbox.
                </p>
                <button onClick={exitForgotMode} className="btn-secondary w-full py-3">
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendReset} className="space-y-4">
                <p className="text-center text-[11px] uppercase tracking-crowd font-extrabold text-charcoal-600">
                  Reset your password
                </p>
                <p className="text-sm text-charcoal-600 leading-relaxed">
                  Drop your email and we'll send you a link to set a new one.
                </p>

                {error && (
                  <p role="alert" className="text-xs font-bold text-sauce-600 bg-sauce-50 border-2 border-sauce-500 rounded-lg px-3 py-2">{error}</p>
                )}

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input"
                    autoComplete="email"
                    disabled={resetSending}
                  />
                </div>

                <button
                  type="submit"
                  disabled={resetSending || !email}
                  className="btn-primary w-full py-3"
                >
                  {resetSending ? (
                    <span className="w-4 h-4 rounded-full border-2 border-cream-50 border-t-transparent animate-spin" />
                  ) : null}
                  {resetSending ? 'Sending…' : 'Send reset link'}
                </button>

                <button
                  type="button"
                  onClick={exitForgotMode}
                  className="w-full text-xs text-charcoal-600 hover:text-night-900 transition-colors py-1 font-bold uppercase tracking-crowd"
                >
                  ← Back to sign in
                </button>
              </form>
            )
          ) : (
            <>
              <p className="text-center text-[11px] uppercase tracking-crowd font-extrabold text-charcoal-600">
                Sign in to pull up a chair
              </p>

              {error && (
                <p role="alert" className="text-xs font-bold text-sauce-600 bg-sauce-50 border-2 border-sauce-500 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={googleLoading || emailLoading}
                className="btn-primary w-full gap-3 py-3.5 text-base"
              >
                {googleLoading ? (
                  <span className="w-5 h-5 rounded-full border-2 border-cream-50 border-t-transparent animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {googleLoading ? 'Redirecting…' : 'Continue with Google'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-night-900/15" />
                <span className="text-[10px] text-charcoal-500 font-extrabold uppercase tracking-crowd">or</span>
                <div className="flex-1 h-px bg-night-900/15" />
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
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(null) }}
                      className="text-xs text-sauce-500 font-bold hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={emailLoading || googleLoading || !email || !password}
                  className="btn-secondary w-full py-3"
                >
                  {emailLoading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-night-800 border-t-transparent animate-spin" />
                  ) : null}
                  {emailLoading ? 'Signing in…' : 'Sign in with email'}
                </button>
              </form>

              <p className="text-center text-xs text-charcoal-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-sauce-500 font-bold hover:underline">
                  Request access
                </Link>
              </p>

              {isPublic && onBrowse && (
                <button
                  onClick={onBrowse}
                  className="w-full text-xs text-charcoal-600 hover:text-night-900 transition-colors py-1 font-bold uppercase tracking-crowd"
                >
                  Browse without signing in →
                </button>
              )}
            </>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-crowd font-extrabold text-charcoal-400">
          WingKingTony — official wing business
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
