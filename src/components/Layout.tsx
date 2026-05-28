import { ReactNode } from 'react'
import type { AuthState } from '../hooks/useAuth'
import AppHeader from './AppHeader'

type View = 'list' | 'map' | 'gallery'

interface Props {
  auth: AuthState
  view: View
  onViewChange: (v: View) => void
  onAddReview: () => void
  readOnly?: boolean
  liveScene?: ReactNode
  children: ReactNode
}

export default function Layout({
  auth, view, onViewChange, onAddReview, readOnly = false, liveScene, children,
}: Props) {
  const user = auth.user

  return (
    <div className="min-h-dvh flex flex-col bg-cream-50">
      <AppHeader view={view} onViewChange={onViewChange} />

      {liveScene}

      <main className="flex-1 relative">
        {children}
      </main>

      <footer
        className="relative border-t-2 border-night-900 bg-night-900 text-cream-100 px-4 py-6 text-center grain-overlay"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <p className="font-display uppercase tracking-tightest text-2xl text-cream-50 leading-none">
          Wing culture lives here
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-crowd text-cream-100/60">
          A WingKingTony joint
          <span aria-hidden="true" className="mx-2 text-sauce-400">·</span>
          <a
            href="https://winkingtony.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-sauce-300 hover:text-sauce-200 inline-flex items-center gap-0.5"
          >
            Winking Tony
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </p>
      </footer>

      {/* Floating add button */}
      {!readOnly && user && (
        <button
          onClick={onAddReview}
          className="fixed right-4 z-30 group flex items-center gap-2
                     bg-sauce-400 text-cream-50 border-2 border-night-900
                     px-4 h-14 rounded-full shadow-sticker
                     hover:bg-sauce-300 hover:shadow-sticker-sauce
                     active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                     transition-all"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          aria-label="Drop a rating"
        >
          <span className="text-2xl font-extrabold leading-none">+</span>
          <span className="hidden sm:inline text-xs font-extrabold uppercase tracking-crowd">
            Drop a take
          </span>
        </button>
      )}
    </div>
  )
}
