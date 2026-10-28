import { ReactNode, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigationType } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

// Same inbox as the home footer's and the profile menu's Contact links.
const CONTACT_EMAIL = 'anthonycap949@gmail.com'

export const DEFAULT_TITLE = 'WingKingTony · Rate chicken wing spots'

/**
 * App-level fallback <title>. Helmet keeps the last title it was given, so
 * without this a page that sets none (the home feed, say) kept whatever the
 * previous page set ("Sign in — …", "Create account — …"). Mounted once above
 * the routes; any page's own <Helmet><title> still wins while it's mounted.
 */
export function DefaultTitle() {
  return (
    <Helmet>
      <title>{DEFAULT_TITLE}</title>
    </Helmet>
  )
}

/**
 * Start each new page at the top. Without this a link tapped halfway down a
 * long page (e.g. "Sign in to join" on an event) opened /login already
 * scrolled past its heading.
 *
 * Only PUSH/REPLACE navigations to a different pathname scroll. POP (Back /
 * Forward) is left alone so the feed and gallery can restore their own saved
 * position, and query-only changes (?tab=, ?view=) keep the user's place.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  const navType = useNavigationType()
  const prevPath = useRef(pathname)

  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    if (navType === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname, navType])

  return null
}

/**
 * Small site footer for every page outside the home Layout (spot, review,
 * profile, list, event, Privacy/Terms…), so Privacy, Terms and Contact are
 * one scroll away everywhere instead of only at the bottom of the feed.
 */
export function SiteFooter() {
  return (
    <footer
      className="border-t-2 border-night-900 bg-night-900 text-cream-100 px-4 pt-2 text-center"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <nav aria-label="Site" className="flex flex-wrap items-center justify-center gap-x-1 text-xs font-bold text-cream-100/80">
        <SiteFooterLink to="/privacy">Privacy</SiteFooterLink>
        <SiteFooterLink to="/terms">Terms</SiteFooterLink>
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('WingKingTony')}`}
          className="inline-flex items-center min-h-11 px-2.5 hover:text-cream-50 underline underline-offset-2 decoration-cream-50/30"
        >
          Contact
        </a>
      </nav>
    </footer>
  )
}

function SiteFooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center min-h-11 px-2.5 hover:text-cream-50 underline underline-offset-2 decoration-cream-50/30"
    >
      {children}
    </Link>
  )
}
