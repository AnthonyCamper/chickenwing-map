import type { AuthState } from '../hooks/useAuth'
import AvatarImage from '../components/ui/AvatarImage'

const ADMIN_EMAIL = 'anthonycap949@gmail.com'

interface Props {
  auth: AuthState
}

export default function PendingApproval({ auth }: Props) {
  const reload = () => window.location.reload()
  const name = auth.profile?.display_name ?? auth.profile?.full_name ?? auth.user?.email ?? ''
  const email = auth.user?.email ?? ''
  const avatar = auth.profile?.avatar_url
  const initial = name.charAt(0).toUpperCase() || '?'

  return (
    <div className="relative min-h-dvh bg-cream-50 grain-overlay flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Splatter accent, kept faint */}
      <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-16 w-[26rem] h-[26rem] bg-splatter opacity-[0.07]" />

      <div className="relative w-full max-w-sm text-center animate-fade-in">
        {/* Avatar as a sticker */}
        <div className="mx-auto w-20 h-20 -rotate-2 rounded-full overflow-hidden border-2 border-night-900 shadow-sticker mb-5 flex items-center justify-center bg-night-700">
          <AvatarImage
            src={avatar}
            alt={name}
            className="w-full h-full object-cover"
            fallback={<span className="text-3xl font-extrabold text-cream-50">{initial}</span>}
          />
        </div>

        <span className="eyebrow">Status — in review</span>
        <h1 className="h-poster-sm mt-2">You’re in line</h1>
        <p className="h-hand text-xl -rotate-2 mt-1">hang tight, almost in</p>

        <p className="text-sm text-charcoal-600 leading-relaxed mt-5 mb-7">
          Hi <strong className="text-night-900">{name || email}</strong>, your account is created.
          On this site an admin approves each new account before it can be used. We’ll let you
          in as soon as yours is approved. Tap “Check status” to see if it’s ready.
        </p>

        {/* Identity card */}
        <div className="card px-5 py-4 text-left mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-night-700 border border-night-900 flex items-center justify-center flex-shrink-0">
              <AvatarImage
                src={avatar}
                alt={name}
                className="w-full h-full object-cover"
                fallback={<span className="text-sm font-extrabold text-cream-50">{initial}</span>}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-night-900 truncate">{name || email}</p>
              <p className="text-xs text-charcoal-600 truncate">{email}</p>
            </div>
            <span className="sticker-gold ml-auto flex-shrink-0">Waiting for approval</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-center">
          <button onClick={reload} className="btn-secondary text-xs min-h-[44px]">
            Check status
          </button>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent('WingKingTony access request')}&body=${encodeURIComponent(`Hi — I requested access as ${email}. Just checking in.`)}`}
            className="inline-flex items-center min-h-[44px] px-2 text-xs text-sauce-500 font-bold uppercase tracking-crowd hover:underline"
          >
            Email the admin
          </a>
          <button
            onClick={auth.signOut}
            className="btn-ghost min-h-[44px] text-xs text-charcoal-500 hover:text-night-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
