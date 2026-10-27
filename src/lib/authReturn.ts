// "Return to" path after an auth wall: where to send someone once they've
// signed in or created an account. Lives in sessionStorage so it survives the
// Google OAuth full-page round-trip. Stored with a timestamp so a stale entry
// (an abandoned sign-in from earlier in the session) doesn't hijack a later,
// unrelated sign-up.

const KEY = 'auth-return-to'
export const RETURN_TO_MAX_AGE_MS = 15 * 60 * 1000

// Auth pages themselves are never a destination.
const AUTH_PATHS = ['/login', '/register', '/reset-password']

export function isAuthPath(path: string): boolean {
  return AUTH_PATHS.some(p => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'))
}

export function isSafeReturnPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !isAuthPath(path)
}

interface Stored { path: string; at: number | null }

function read(): Stored | null {
  let raw: string | null = null
  try { raw = sessionStorage.getItem(KEY) } catch { return null }
  if (!raw) return null
  if (raw.startsWith('{')) {
    try {
      const v = JSON.parse(raw) as { path?: unknown; at?: unknown }
      if (typeof v.path !== 'string') return null
      return { path: v.path, at: typeof v.at === 'number' ? v.at : null }
    } catch { return null }
  }
  // Legacy bare path (CrawlEditor writes one right before its /login bounce).
  return { path: raw, at: null }
}

/** Remember a page to come back to after auth. Ignores auth pages, so a
 *  click made while already on /register can't overwrite the real origin. */
export function rememberReturnTo(path: string = window.location.pathname + window.location.search) {
  if (!isSafeReturnPath(path)) return
  try { sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })) } catch { /* ignore */ }
}

export function clearReturnTo() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}

function usable(v: Stored | null, now: number): string | null {
  if (!v) return null
  if (v.at !== null && now - v.at > RETURN_TO_MAX_AGE_MS) return null
  return isSafeReturnPath(v.path) ? v.path : null
}

/** The stored path if it's still usable (safe, not expired), without
 *  consuming it. */
export function peekReturnTo(now: number = Date.now()): string | null {
  return usable(read(), now)
}

/** Read and clear the stored path. Returns null when missing, unsafe or
 *  older than RETURN_TO_MAX_AGE_MS. */
export function takeReturnTo(now: number = Date.now()): string | null {
  const v = read()
  if (!v) return null
  clearReturnTo()
  return usable(v, now)
}
