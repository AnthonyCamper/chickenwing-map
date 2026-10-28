import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { friendlyAuthError } from '../lib/authErrors'
import { AuthErrorAlert, GoogleIcon, LegalLinks } from './Register'

interface Props {
  onSignInGoogle: () => Promise<void>
  onSignInEmail: (email: string, password: string) => Promise<{ error: string | null }>
  isPublic: boolean
  onBrowse?: () => void
  authError?: string | null
}

export default function Login({ onSignInGoogle, onSignInEmail, isPublic, onBrowse, authError }: Props) {
  // Register's "already registered" links pass the email (and whether to open
  // the reset form) so the person doesn't have to type it again.
  const linkState = (useLocation().state ?? null) as { email?: string; forgot?: boolean } | null
  const [googleLoading, setGoogleLoading] = useState(false)
  const [email, setEmail] = useState(linkState?.email ?? '')
  const [password, setPassword] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [error, setError] = useState<string | null>(authError ? friendlyAuthError(authError) : null)

  // Forgot-password flow
  const [forgotMode, setForgotMode] = useState(!!linkState?.forgot)
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
    const result = await onSignInEmail(email.trim(), password)
    if (result.error) {
      setError(friendlyAuthError(result.error))
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
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    setResetSending(false)
    if (resetError) {
      setError(friendlyAuthError(resetError.message))
      return
    }
    setResetSent(true)
  }

  const enterForgotMode = () => {
    setForgotMode(true)
    setError(null)
  }

  const exitForgotMode = () => {
    setForgotMode(false)
    setResetSent(false)
    setError(null)
  }

  return (
    // Small phones: compact header and card so "Sign in with email" fits on
    // the first screen (it sat at y=720 on a 375×667 phone).
    <div className="relative min-h-dvh bg-cream-50 grain-overlay flex flex-col items-center justify-start sm:justify-center px-4 sm:px-6 py-4 sm:py-12 overflow-hidden">
      <Helmet>
        <title>Sign in — WingKingTony</title>
      </Helmet>

      {/* Splatter accents, kept faint */}
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.08]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.07] rotate-180" />

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Brand mark */}
        <div className="flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-0 text-left sm:text-center mb-4 sm:mb-8">
          <img
            src="/favicon.svg"
            alt=""
            className="w-12 h-12 sm:w-20 sm:h-20 flex-shrink-0 -rotate-2 rounded-xl sm:rounded-2xl border-2 border-night-900 shadow-sticker-sm sm:shadow-sticker sm:mb-5"
          />
          <div className="min-w-0">
            <span className="eyebrow hidden sm:inline">Welcome back</span>
            <h1 className="h-poster-sm sm:mt-1">WingKingTony</h1>
            <p className="hidden sm:block h-hand text-xl -rotate-2 mt-1">
              ate it. rated it. let the people know.
            </p>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="card px-5 py-5 sm:px-6 sm:py-7 space-y-4 sm:space-y-5">
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
                  Enter your email and we'll send you a link to set a new password.
                </p>

                {error && <AuthErrorAlert message={error} />}

                <div>
                  <label className="label" htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
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
                  className="w-full min-h-[44px] text-xs text-charcoal-600 hover:text-night-900 transition-colors py-1 font-bold uppercase tracking-crowd"
                >
                  ← Back to sign in
                </button>
              </form>
            )
          ) : (
            <>
              <p className="text-center text-[11px] uppercase tracking-crowd font-extrabold text-charcoal-600">
                Sign in to rate wings and comment
              </p>

              {error && <AuthErrorAlert message={error} onResetPassword={enterForgotMode} />}

              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={googleLoading || emailLoading}
                className="btn-primary w-full gap-3 py-2.5 sm:py-3.5 text-sm sm:text-base tracking-wide sm:tracking-crowd"
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
                  <label className="label" htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
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
                  <label className="label" htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input"
                    autoComplete="current-password"
                    disabled={emailLoading || googleLoading}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={enterForgotMode}
                      className="min-h-[44px] px-1 -mr-1 text-xs text-sauce-500 font-bold hover:underline"
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
                New here?{' '}
                <Link
                  to="/register"
                  className="inline-flex items-center min-h-[44px] px-1 text-sauce-500 font-bold hover:underline"
                >
                  Create a free account
                </Link>
              </p>

              {isPublic && onBrowse && (
                <button
                  onClick={onBrowse}
                  className="w-full min-h-[44px] text-xs text-charcoal-600 hover:text-night-900 transition-colors py-1 font-bold uppercase tracking-crowd"
                >
                  Browse without signing in →
                </button>
              )}
            </>
          )}
        </div>

        <LegalLinks />
      </div>
    </div>
  )
}
