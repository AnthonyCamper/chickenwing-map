interface Props {
  email: string
  onSignOut: () => Promise<void>
}

export default function Unauthorized({ email, onSignOut }: Props) {
  return (
    <div className="min-h-dvh bg-warmgray-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-amber-100 opacity-30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm text-center animate-fade-in">
        <div className="text-5xl mb-6">🔒</div>
        <h1 className="font-display text-2xl text-charcoal-800 mb-3">
          Not on the list
        </h1>
        <p className="text-sm text-charcoal-400 leading-relaxed mb-2">
          <span className="font-medium text-charcoal-600">{email}</span> does not have access to this app.
        </p>
        <p className="text-sm text-charcoal-400 leading-relaxed mb-8">
          Ask an admin to add your email to the approved users list.
        </p>

        <button onClick={onSignOut} className="btn-secondary">
          Sign out
        </button>
      </div>
    </div>
  )
}
