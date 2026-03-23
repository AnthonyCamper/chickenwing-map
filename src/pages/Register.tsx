import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  onSignUp: (
    email: string,
    password: string,
    displayName: string,
    avatar?: File
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>
}

export default function Register({ onSignUp }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [needsEmail, setNeedsEmail] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5 MB')
      return
    }
    setAvatar(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !displayName) return
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError(null)
    setLoading(true)
    const result = await onSignUp(email, password, displayName, avatar ?? undefined)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else if (result.needsEmailConfirmation) {
      setNeedsEmail(true)
    } else {
      // Session was returned — auth state change will handle redirect
      setDone(true)
    }
  }

  if (needsEmail) {
    return (
      <div className="min-h-dvh bg-warmgray-50 flex flex-col items-center justify-center px-6 py-12">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-100 opacity-40 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-warmgray-300 opacity-50 blur-3xl" />
        </div>
        <div className="relative w-full max-w-sm text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-amber-400 flex items-center justify-center shadow-elevated mb-5 text-3xl mx-auto">
            ✉️
          </div>
          <h2 className="font-display text-2xl text-charcoal-800 mb-3">Check your email</h2>
          <p className="text-sm text-charcoal-500 leading-relaxed mb-6">
            We sent a confirmation link to <strong>{email}</strong>. Click it to verify your address,
            then come back here — your request will be reviewed by an admin.
          </p>
          <Link to="/" className="btn-secondary inline-flex">
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
    <div className="min-h-dvh bg-warmgray-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-100 opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-warmgray-300 opacity-50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-amber-400 flex items-center justify-center shadow-elevated mb-5 text-3xl">
            🍗
          </div>
          <h1 className="font-display text-3xl text-charcoal-800 tracking-tight">
            Request access
          </h1>
          <p className="mt-2 text-sm text-charcoal-400 text-center leading-relaxed">
            Fill in your details and an admin will approve your account.
          </p>
        </div>

        <div className="card px-8 py-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar picker */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-full overflow-hidden bg-warmgray-100 ring-2 ring-warmgray-200 hover:ring-amber-300 transition-all flex items-center justify-center text-charcoal-300 hover:text-charcoal-500 flex-shrink-0"
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
                className="text-xs text-amber-500 hover:underline"
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
              <label className="label">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="input"
                autoComplete="name"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="input"
                autoComplete="new-password"
                disabled={loading}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password || !displayName}
              className="btn-primary w-full py-3.5"
            >
              {loading ? (
                <span className="w-5 h-5 rounded-full border-2 border-white border-t-amber-200 animate-spin" />
              ) : null}
              {loading ? 'Submitting…' : 'Request access'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-charcoal-400">
            Already have an account?{' '}
            <Link to="/" className="text-amber-500 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-charcoal-300">
          WingMap
        </p>
      </div>
    </div>
  )
}
