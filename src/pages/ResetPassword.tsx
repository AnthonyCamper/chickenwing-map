import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

type Stage = 'checking' | 'ready' | 'no-session'

/**
 * Landing page for the Supabase password-recovery link.
 * The email link redirects here with a recovery token in the URL; supabase-js
 * exchanges it for a session automatically (detectSessionInUrl). Once that
 * session exists we let the user set a new password via updateUser.
 */
export default function ResetPassword() {
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // The recovery token exchange can land slightly after mount, so listen
    // for the auth event AND poll the current session, with a grace window
    // before declaring the link dead.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || session) setStage('ready')
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) setStage('ready')
    })

    const timer = window.setTimeout(() => {
      if (!cancelled) setStage(prev => (prev === 'checking' ? 'no-session' : prev))
    }, 3000)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }
    setError(null)
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    toast.success('Password updated — welcome back')
    navigate('/', { replace: true })
  }

  return (
    <div className="relative min-h-dvh bg-cream-50 grain-overlay flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <Helmet>
        <title>Reset password — WingKingTony</title>
      </Helmet>
      <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.07]" />

      <div className="relative w-full max-w-sm text-center animate-fade-in">
        <div className="inline-flex items-center justify-center mb-5">
          <img src="/favicon.svg" alt="" className="w-16 h-16 -rotate-2 rounded-2xl border-2 border-night-900 shadow-sticker" />
        </div>

        {stage === 'checking' && (
          <>
            <span className="eyebrow">Hold up</span>
            <h1 className="h-poster-sm mt-2 mb-6">Checking your link…</h1>
            <div className="mx-auto w-10 h-10 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
          </>
        )}

        {stage === 'no-session' && (
          <>
            <span className="eyebrow">Link expired</span>
            <h1 className="h-poster-sm mt-2">That link's cold</h1>
            <p className="text-sm text-charcoal-600 leading-relaxed mt-4 mb-6">
              This reset link is invalid or has expired. Head back to the sign-in
              page and request a fresh one.
            </p>
            <Link to="/login" className="btn-primary">Back to sign in</Link>
          </>
        )}

        {stage === 'ready' && (
          <>
            <span className="eyebrow">Fresh sauce</span>
            <h1 className="h-poster-sm mt-2">Set a new password</h1>
            <p className="h-hand text-xl -rotate-2 mt-1 mb-6">make it a keeper</p>

            <form onSubmit={handleSubmit} className="card px-6 py-6 space-y-4 text-left">
              <div>
                <label className="label" htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="input"
                  autoComplete="new-password"
                  disabled={saving}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="label" htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Same again"
                  className="input"
                  autoComplete="new-password"
                  disabled={saving}
                  required
                />
              </div>

              {error && (
                <p role="alert" className="text-xs font-bold text-sauce-600 bg-sauce-50 border-2 border-sauce-500 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving || !password || !confirm}
                className="btn-primary w-full py-3.5"
              >
                {saving ? (
                  <span className="w-5 h-5 rounded-full border-2 border-cream-50 border-t-transparent animate-spin" />
                ) : null}
                {saving ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
