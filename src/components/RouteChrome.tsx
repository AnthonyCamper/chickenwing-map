import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

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
