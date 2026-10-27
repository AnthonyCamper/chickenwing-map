import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  EMAIL_FORMAT_MESSAGE,
  MIN_PASSWORD_LENGTH,
  friendlyAuthError,
  isValidEmail,
  passwordProblem,
  signUpProblem,
} from '../lib/authErrors'
import { validateImageFile } from '../lib/imageValidation'

function scorePassword(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++
  const label = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score]
  return { score: score as 0 | 1 | 2 | 3 | 4, label }
}

interface Props {
  onSignUp: (
    email: string,
    password: string,
    displayName: string,
    avatar?: File
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>
  /** Public site: accounts work straight away. Private site: an admin
   *  approves each new account first, and the copy has to say so. */
  isPublic?: boolean
}

export default function Register({ onSignUp, isPublic = true }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [needsEmail, setNeedsEmail] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Revoke any previously-created object URL when the preview changes or unmounts.
  useEffect(() => {
    if (!avatarPreview) return
    return () => URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again after an error
    if (!file) return
    // Decode it: a renamed non-image passes the type/extension check and
    // would be saved as a broken avatar.
    const problem = await validateImageFile(file, 5)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setAvatar(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const pwStrength = useMemo(() => scorePassword(password), [password])
  const formProblem = signUpProblem({ displayName, email, password })
  const pwProblem = password ? passwordProblem(password) : null
  const showEmailError = emailTouched && email.trim() !== '' && !isValidEmail(email)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formProblem) {
      setEmailTouched(true)
      setError(formProblem)
      return
    }
    setError(null)
    setLoading(true)
    const result = await onSignUp(email.trim(), password, displayName.trim(), avatar ?? undefined)
    setLoading(false)

    if (result.error) {
      setError(friendlyAuthError(result.error))
    } else if (result.needsEmailConfirmation) {
      setNeedsEmail(true)
    } else {
      // Session was returned — auth state change will handle redirect
      setDone(true)
    }
  }

  if (needsEmail) {
    return (
      <div className="relative min-h-dvh bg-cream-50 grain-overlay flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
        <Helmet>
          <title>Check your email — WingKingTony</title>
        </Helmet>
        <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.07]" />
        <div className="relative w-full max-w-sm text-center animate-fade-in">
          <div className="mx-auto w-20 h-20 -rotate-2 rounded-2xl border-2 border-night-900 shadow-sticker mb-5 flex items-center justify-center bg-cream-100 text-3xl">
            ✉️
          </div>
          <span className="eyebrow">One more step</span>
          <h2 className="h-poster-sm mt-2 mb-4">Check your email</h2>
          <p className="text-sm text-charcoal-600 leading-relaxed mb-6 break-words">
            We sent a confirmation link to <strong className="text-night-900">{email}</strong>.
            Click it to confirm your address, then sign in.
            {!isPublic && ' An admin approves new accounts before you can see the site.'}
          </p>
          <Link to="/login" className="btn-secondary inline-flex">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return null // Auth state change in useAuth will re-render App with pending screen
  }

  return (
    <div className="relative min-h-dvh bg-cream-50 grain-overlay flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <Helmet>
        <title>Create account — WingKingTony</title>
      </Helmet>

      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.08]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.07] rotate-180" />

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/favicon.svg"
            alt=""
            className="w-20 h-20 -rotate-2 rounded-2xl border-2 border-night-900 shadow-sticker mb-5"
          />
          <span className="eyebrow">Join the wing council</span>
          <h1 className="h-poster-sm mt-1">Create account</h1>
          <p className="text-sm text-charcoal-600 mt-3 leading-relaxed">
            {isPublic
              ? 'It’s free, and your account works right away. Then you can rate wing spots, post photos and comment.'
              : 'It’s free. An admin approves new accounts before you can see the site.'}
          </p>
        </div>

        <div className="card px-6 py-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar picker */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 -rotate-2 rounded-full overflow-hidden bg-night-700 border-2 border-night-900 shadow-sticker hover:border-sauce-400 transition-colors flex items-center justify-center text-cream-100 flex-shrink-0"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">👤</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="min-h-[44px] px-2 text-xs text-sauce-500 font-bold hover:underline"
              >
                {avatarPreview ? 'Change photo' : 'Add profile photo (optional)'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div>
              <label className="label" htmlFor="register-name">Display name</label>
              <input
                id="register-name"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="input"
                autoComplete="name"
                disabled={loading}
                required
                maxLength={60}
              />
              <p className="text-[11px] text-charcoal-500 mt-1">Shown publicly next to your reviews.</p>
            </div>

            <div>
              <label className="label" htmlFor="register-email">Email</label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
                disabled={loading}
                required
                aria-invalid={showEmailError || undefined}
                aria-describedby={showEmailError ? 'email-error' : undefined}
              />
              {showEmailError ? (
                <p id="email-error" className="text-[11px] font-bold text-sauce-600 mt-1">{EMAIL_FORMAT_MESSAGE}</p>
              ) : (
                <p className="text-[11px] text-charcoal-500 mt-1">Never shown to other people.</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="register-password">Password</label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                autoComplete="new-password"
                disabled={loading}
                required
                minLength={MIN_PASSWORD_LENGTH}
                aria-invalid={pwProblem ? true : undefined}
                aria-describedby="pw-help pw-strength"
              />
              <p
                id="pw-help"
                className={`text-[11px] mt-1 ${pwProblem ? 'font-bold text-sauce-600' : 'text-charcoal-500'}`}
              >
                {pwProblem ?? `At least ${MIN_PASSWORD_LENGTH} characters.`}
              </p>
              {password && (
                <div id="pw-strength" className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-0.5 h-1.5">
                    {[0, 1, 2, 3].map(i => (
                      <span
                        key={i}
                        className={`flex-1 rounded-full transition-colors ${
                          i < pwStrength.score
                            ? pwStrength.score <= 1 ? 'bg-sauce-500'
                              : pwStrength.score === 2 ? 'bg-ember-300'
                              : pwStrength.score === 3 ? 'bg-gold-300'
                              : 'bg-neon-400'
                            : 'bg-cream-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-crowd text-charcoal-500 min-w-[60px] text-right">
                    {pwStrength.label}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <p role="alert" className="text-xs font-bold text-sauce-600 bg-sauce-50 border-2 border-sauce-500 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !!formProblem}
              aria-describedby={formProblem ? 'register-blocker' : undefined}
              className="btn-primary w-full py-3.5"
            >
              {loading ? (
                <span className="w-5 h-5 rounded-full border-2 border-cream-50 border-t-transparent animate-spin" />
              ) : null}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
            {formProblem && formProblem !== error && (
              <p id="register-blocker" className="-mt-2 text-center text-[11px] text-charcoal-500">
                {formProblem}
              </p>
            )}

            <div className="text-[11px] text-charcoal-500 leading-relaxed text-center space-y-1">
              <p>
                By creating an account you agree to the{' '}
                <Link to="/terms" target="_blank" className="text-sauce-500 font-bold hover:underline">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" target="_blank" className="text-sauce-500 font-bold hover:underline">Privacy Policy</Link>.
              </p>
              <p>Your name, profile photo, reviews, photos and comments are public. Your email is not.</p>
            </div>
          </form>

          <p className="mt-4 text-center text-xs text-charcoal-600">
            Already have an account?{' '}
            <Link to="/login" className="inline-flex items-center min-h-[44px] px-1 text-sauce-500 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <LegalLinks />
      </div>
    </div>
  )
}

export function LegalLinks() {
  return (
    <p className="mt-6 flex items-center justify-center gap-1 text-[10px] uppercase tracking-crowd font-extrabold text-charcoal-400">
      <span>WingKingTony</span>
      <span aria-hidden>·</span>
      <Link to="/privacy" className="inline-flex items-center min-h-[44px] px-1 hover:text-night-900">Privacy</Link>
      <span aria-hidden>·</span>
      <Link to="/terms" className="inline-flex items-center min-h-[44px] px-1 hover:text-night-900">Terms</Link>
    </p>
  )
}
