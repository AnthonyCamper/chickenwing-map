import { createContext, useCallback, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBottomSheetDrag } from '../hooks/useBottomSheetDrag'

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthGateContextValue {
  /** Returns true if authenticated. If not, shows the auth prompt and returns false. */
  requireAuth: () => boolean
}

const AuthGateContext = createContext<AuthGateContextValue>({ requireAuth: () => true })

export function useAuthGate() {
  return useContext(AuthGateContext)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ProviderProps {
  isAuthenticated: boolean
  onSignInGoogle?: () => Promise<void>
  children: React.ReactNode
}

export function AuthGateProvider({ isAuthenticated, onSignInGoogle, children }: ProviderProps) {
  const [open, setOpen] = useState(false)

  const requireAuth = useCallback(() => {
    if (isAuthenticated) return true
    setOpen(true)
    return false
  }, [isAuthenticated])

  return (
    <AuthGateContext.Provider value={{ requireAuth }}>
      {children}
      {open && (
        <AuthGateModal
          onClose={() => setOpen(false)}
          onSignInGoogle={onSignInGoogle}
        />
      )}
    </AuthGateContext.Provider>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function AuthGateModal({
  onClose,
  onSignInGoogle,
}: {
  onClose: () => void
  onSignInGoogle?: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag()

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl
                   shadow-2xl animate-slide-up overflow-hidden flex flex-col"
        style={sheetStyle}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div
          className="sm:hidden flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none select-none flex-shrink-0"
          role="slider"
          aria-label={expanded ? 'Drag down to collapse' : 'Drag up to expand'}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={expanded ? 1 : 0}
          tabIndex={0}
          {...handleProps}
        >
          <div className={`w-10 h-1 rounded-full transition-colors duration-200 ${expanded ? 'bg-warmgray-300' : 'bg-warmgray-200'}`} />
        </div>

        {/* Decorative gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-36 bg-gradient-to-b from-amber-50/80 to-transparent pointer-events-none" />

        <div className="relative px-8 pt-6 flex flex-col items-center text-center pb-safe-8 sm:pb-8 overflow-y-auto flex-1">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-warmgray-200 flex items-center justify-center mb-5 shadow-soft">
            <span className="text-2xl" role="img" aria-label="wings">🍗</span>
          </div>

          {/* Copy */}
          <h2 className="font-display text-xl text-charcoal-800 mb-2">
            Join the conversation
          </h2>
          <p className="text-sm text-charcoal-400 leading-relaxed max-w-[260px] mb-7">
            Sign up or log in to react, comment, and share your thoughts.
          </p>

          {/* CTAs */}
          <div className="w-full space-y-3">
            {/* Google sign-in — primary CTA */}
            {onSignInGoogle && (
              <>
                <button
                  onClick={onSignInGoogle}
                  className="btn w-full py-3.5 text-base bg-white border border-warmgray-300
                             text-charcoal-700 hover:bg-warmgray-50 active:bg-warmgray-100 shadow-soft"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 py-0.5">
                  <div className="flex-1 h-px bg-warmgray-200" />
                  <span className="text-xs text-charcoal-300 select-none">or</span>
                  <div className="flex-1 h-px bg-warmgray-200" />
                </div>
              </>
            )}

            <button
              onClick={() => navigate('/register')}
              className="btn-primary w-full py-3.5 text-base"
            >
              Create an account
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-secondary w-full py-3"
            >
              Sign in
            </button>
          </div>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="mt-5 text-xs text-charcoal-300 hover:text-charcoal-500 transition-colors"
          >
            Continue browsing
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Google Icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}
