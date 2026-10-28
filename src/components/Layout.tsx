import { ReactNode, RefObject, useEffect, useRef, useState } from 'react'
import type { AuthState } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import AppHeader from './AppHeader'
import { useFabHidden } from '../hooks/useHideFab'

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

const SHOW_AFTER_UP_PX = 200

/**
 * True after the user scrolls down, false again once they scroll back up
 * deliberately (SHOW_AFTER_UP_PX) or get back near the top. The FAB tucks
 * away while reading down a feed so it can't sit on the Share / Comment row
 * the thumb is heading for, and comes back on a real scroll up — the usual
 * mobile pattern.
 */
function useScrolledDown(paused: boolean): boolean {
  const [down, setDown] = useState(false)
  // Modals lock the body (position: fixed) and restore the scroll position
  // when they close; those jumps aren't the user scrolling, so ignore scroll
  // events while a sheet is open and just after it closes.
  const ignoreUntil = useRef(0)
  useEffect(() => {
    ignoreUntil.current = paused ? Infinity : Date.now() + 400
    if (paused) setDown(false)
  }, [paused])

  useEffect(() => {
    let lastY = window.scrollY
    let upSince = 0 // how far the user has scrolled up since last scrolling down
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        const dy = y - lastY
        if (Date.now() < ignoreUntil.current) { lastY = y; return }
        // Ignore tiny jitters (momentum scrolling, address-bar resize)
        if (Math.abs(dy) < 8) return
        lastY = y
        if (y <= 80) { upSince = 0; setDown(false); return }
        if (dy > 0) { upSince = 0; setDown(true); return }
        // Nudging the page up a little to line up a card's buttons isn't
        // "going back up": only a deliberate scroll up brings the button
        // back, so it doesn't land on the Share row being aimed at (S01).
        upSince -= dy
        if (upSince >= SHOW_AFTER_UP_PX) setDown(false)
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return down
}

// Height of the FAB's bottom band: 1.5rem gap + 3.5rem button + 1rem air.
const FAB_SPACE = '6rem'

// Below this width the floating button would sit on the feed's own buttons
// (the content column reaches the screen edge), so phones and tablets get the
// in-page "Rate wings" button at the top instead and only a small round
// floating "+" further down. Wider screens keep the labelled floating pill,
// which sits in the empty margin beside the 672px column.
const WIDE_QUERY = '(min-width: 1100px)'

function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches
  const [matches, setMatches] = useState(get)
  useEffect(() => {
    const mql = window.matchMedia?.(query)
    if (!mql) return
    const on = () => setMatches(mql.matches)
    on()
    mql.addEventListener?.('change', on)
    return () => mql.removeEventListener?.('change', on)
  }, [query])
  return matches
}

/**
 * True while `el` is on screen below the sticky header. Starts true so the
 * floating button doesn't flash in before the first observation.
 */
function useInView(ref: RefObject<HTMLElement>, active: boolean): boolean {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!active || !el || typeof IntersectionObserver === 'undefined') return
    // The sticky header (~4.5rem) covers the top of the screen.
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '-72px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, active])
  return inView
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
  const sheetOpen = useFabHidden()
  const scrolledDown = useScrolledDown(sheetOpen)
  const showFab = !readOnly && !!user
  const wide = useMediaQuery(WIDE_QUERY)
  // Phones/tablets, scrolling pages: an in-page "Rate wings" button at the
  // top. While it's on screen there is no floating button at all, so nothing
  // covers the first card's chips, comment row or Share (S01). Past it, a
  // compact round "+" floats instead of the wide pill. The map has no page to
  // scroll, so it keeps the labelled floating pill.
  const docked = showFab && !wide && view !== 'map'
  const dockRef = useRef<HTMLDivElement>(null)
  const dockInView = useInView(dockRef, docked)
  const compact = docked
  // Rendered but tucked away while scrolling down (or while the in-page
  // button is visible); removed entirely while a text field has focus or a
  // sheet/modal asked it to hide (useHideFab).
  const fabMounted = showFab && !typing && !sheetOpen
  const fabTucked = scrolledDown || (docked && dockInView)
  const fabOnScreen = fabMounted && !fabTucked

  // Toasts sit at the bottom of the screen (App's Toaster) and read this to
  // stay above the button instead of covering it.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--wkt-fab-space', fabOnScreen ? FAB_SPACE : '0px')
    return () => { root.style.removeProperty('--wkt-fab-space') }
  }, [fabOnScreen])

  return (
    <div className="min-h-dvh flex flex-col bg-cream-50">
      <AppHeader view={view} onViewChange={onViewChange} />

      {liveScene}

      {/* No bottom padding needed here: the footer below (with its own
          FAB-height padding) lets the last row of any view scroll clear of
          the floating button. The map has no footer, but it fills the screen
          and its spot sheet hides the button (useHideFab). */}
      <main className="flex-1 relative">
        {docked && (
          <div ref={dockRef} className="max-w-2xl mx-auto px-4 pt-3 -mb-1 flex justify-end">
            <button
              type="button"
              onClick={onAddReview}
              className="flex items-center gap-2 bg-sauce-400 text-cream-50 border-2 border-night-900
                         pl-3.5 pr-4 h-11 rounded-full shadow-sticker
                         hover:bg-sauce-300 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                         transition-all duration-200"
            >
              <span className="text-xl font-extrabold leading-none" aria-hidden="true">+</span>
              <span className="text-xs font-extrabold uppercase tracking-crowd">Rate wings</span>
            </button>
          </div>
        )}
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
            Made by WingKingTony
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

      {/* Floating add button: labelled pill on wide screens and the map,
          a compact round "+" further down a page on phones */}
      {fabMounted && (
        <button
          onClick={onAddReview}
          className={`fixed z-30 group flex items-center justify-center gap-2
                     bg-sauce-400 text-cream-50 border-2 border-night-900
                     ${compact
                       // Tucked into the screen's right gutter, clear of the
                       // middle of a feed card's Share button
                       ? 'right-2 w-14 h-14'
                       : 'right-4 pl-4 pr-5 h-14'} rounded-full shadow-sticker
                     hover:bg-sauce-300 hover:shadow-sticker-sauce
                     active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                     transition-all duration-200
                     ${fabTucked ? 'translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none' : ''}`}
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          aria-label="Rate wings"
          title="Rate wings"
          aria-hidden={fabTucked || undefined}
          tabIndex={fabTucked ? -1 : undefined}
        >
          <span className={`${compact ? 'text-3xl' : 'text-2xl'} font-extrabold leading-none`} aria-hidden="true">+</span>
          {!compact && (
            <span className="text-xs font-extrabold uppercase tracking-crowd">
              Rate wings
            </span>
          )}
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
