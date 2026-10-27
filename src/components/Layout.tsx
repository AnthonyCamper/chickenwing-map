import { ReactNode, useEffect, useState } from 'react'
import type { AuthState } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import AppHeader from './AppHeader'

// Same inbox as the "Contact admin" button on App's status screens.
const CONTACT_EMAIL = 'anthonycap949@gmail.com'

/**
 * True while a text field has focus. The FAB hides during typing so it can't
 * sit on top of inline comment composers (its fixed bottom-right position
 * collides with a card's Post button) or the iOS keyboard's viewport.
 */
function useTypingFocus(): boolean {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const isTextField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    const onFocusIn = (e: FocusEvent) => { if (isTextField(e.target)) setTyping(true) }
    const onFocusOut = () => {
      // wait a tick: focus may be moving between fields
      setTimeout(() => setTyping(isTextField(document.activeElement)), 0)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])
  return typing
}

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
  const typing = useTypingFocus()
  const showFab = !readOnly && !!user

  return (
    <div className="min-h-dvh flex flex-col bg-cream-50">
      <AppHeader view={view} onViewChange={onViewChange} />

      {liveScene}

      <main className="flex-1 relative">
        {children}
      </main>

      {/* The map fills the screen exactly; a footer under it made the page
          scroll, sliding the map's zoom buttons under the sticky header. */}
      {view !== 'map' && (
        <footer
          className="relative border-t-2 border-night-900 bg-night-900 text-cream-100 px-4 py-6 text-center grain-overlay"
          style={{
            // While the floating "Rate wings" button is on screen, leave room
            // under the footer so the button never sits on top of its links.
            paddingBottom: showFab
              ? 'calc(6.5rem + env(safe-area-inset-bottom))'
              : 'calc(1.5rem + env(safe-area-inset-bottom))',
          }}
        >
          <p className="font-display uppercase tracking-tightest text-2xl text-cream-50 leading-none">
            Wing culture lives here
          </p>
          <nav aria-label="Site" className="relative z-[1] mt-3 flex flex-wrap items-center justify-center gap-x-1 text-xs font-bold text-cream-100/80">
            <FooterLink to="/events">Events</FooterLink>
            <FooterLink to="/privacy">Privacy</FooterLink>
            <FooterLink to="/terms">Terms</FooterLink>
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('WingKingTony')}`}
              className="inline-flex items-center min-h-11 px-2.5 hover:text-cream-50 underline underline-offset-2 decoration-cream-50/30"
            >
              Contact
            </a>
          </nav>
          <p className="relative z-[1] mt-1 text-[11px] uppercase tracking-crowd text-cream-100/60">
            A WingKingTony joint
            <span aria-hidden="true" className="mx-2 text-sauce-400">·</span>
            {/* Brand easter egg, kept on purpose; the real site links are above */}
            <a
              href="https://winkingtony.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-extrabold text-sauce-300 hover:text-sauce-200 inline-flex items-center gap-0.5 min-h-11"
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
      )}

      {/* Floating add button */}
      {showFab && !typing && (
        <button
          onClick={onAddReview}
          className="fixed right-4 z-30 group flex items-center gap-2
                     bg-sauce-400 text-cream-50 border-2 border-night-900
                     pl-4 pr-5 h-14 rounded-full shadow-sticker
                     hover:bg-sauce-300 hover:shadow-sticker-sauce
                     active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                     transition-all"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          aria-label="Rate wings"
        >
          <span className="text-2xl font-extrabold leading-none" aria-hidden="true">+</span>
          <span className="text-xs font-extrabold uppercase tracking-crowd">
            Rate wings
          </span>
        </button>
      )}
    </div>
  )
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center min-h-11 px-2.5 hover:text-cream-50 underline underline-offset-2 decoration-cream-50/30"
    >
      {children}
    </Link>
  )
}
