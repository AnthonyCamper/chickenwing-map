import type { AuthState } from '../hooks/useAuth'

const ADMIN_EMAIL = 'anthonycap949@gmail.com'

interface Props {
  auth: AuthState
}

export default function PendingApproval({ auth }: Props) {
  const reload = () => window.location.reload()
  const name = auth.profile?.display_name ?? auth.profile?.full_name ?? auth.user?.email ?? ''
  const email = auth.user?.email ?? ''
  const avatar = auth.profile?.avatar_url

  return (
    <div className="min-h-dvh bg-warmgray-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-100 opacity-40 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-warmgray-300 opacity-50 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm text-center animate-fade-in">
        {/* Avatar */}
        <div className="mx-auto w-20 h-20 rounded-full overflow-hidden ring-4 ring-warmgray-200 mb-6 flex items-center justify-center bg-warmgray-100">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-semibold text-charcoal-400">
              {name.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>

        <h2 className="font-display text-2xl text-charcoal-800 mb-2">
          You're on the list ✓
        </h2>

        <p className="text-sm text-charcoal-500 leading-relaxed mb-1">
          Hi <strong>{name || email}</strong>, your request has been received.
        </p>
        <p className="text-sm text-charcoal-600 leading-relaxed mb-8">
          The admin will review your account soon. You'll be able to sign in once it's approved.
        </p>

        <div className="card px-6 py-5 text-left mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-warmgray-100 flex items-center justify-center flex-shrink-0">
              {avatar ? (
                <img src={avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-charcoal-500">
                  {name.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-charcoal-700 truncate">{name || email}</p>
              <p className="text-xs text-charcoal-600 truncate">{email}</p>
            </div>
            <span className="ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 flex-shrink-0">
              Pending
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-center">
          <button
            onClick={reload}
            className="btn-secondary text-xs"
          >
            Check status
          </button>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('WingMap access request')}&body=${encodeURIComponent(`Hi — I requested access as ${email}. Just checking in.`)}`}
            className="text-xs text-amber-500 font-semibold hover:underline"
          >
            Contact admin
          </a>
          <button
            onClick={auth.signOut}
            className="btn-ghost text-xs text-charcoal-500 hover:text-charcoal-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
