import { lazy, type ComponentType } from 'react'

// A tab opened before a deploy still runs the old code, which asks for the
// old hashed chunk files ("SpotPage-abc123.js"). The deploy deleted them, so
// the next tap into a lazy page fails with "Failed to fetch dynamically
// imported module" (Safari: "Importing a module script failed"). Phones keep
// tabs alive for days, so this is the normal case after a deploy, not an edge
// case. The fix is one full reload: index.html is revalidated on reload, so
// the page comes back on the new version, at the URL the user was going to.

const RELOAD_KEY = 'wkt-stale-reload-at'
// Don't auto-reload again within this window. If the reload didn't help (a
// stale CDN copy of index.html, a genuinely missing file), a second automatic
// reload would only loop; the ErrorBoundary's Reload button takes over.
const RELOAD_COOLDOWN_MS = 60_000

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
  /Unable to preload CSS/i, // Vite's CSS preloader
  /Loading (CSS )?chunk [\w-]+ failed/i, // webpack-style wording
  /is not a valid JavaScript MIME type/i, // HTML 404 page served for a .js file
]

/** True for errors caused by a code file that couldn't be downloaded. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const name = (error as { name?: unknown }).name
  if (name === 'ChunkLoadError') return true
  const message = error instanceof Error ? error.message : String(error)
  return CHUNK_ERROR_PATTERNS.some(re => re.test(message))
}

let reloading = false
// Background work (idle prefetch) that must never reload the page on its own:
// the user may be halfway through typing a review.
let quietDepth = 0

/**
 * Run background code loading without the page-wide auto-reload. If it hits
 * a stale chunk, the error is swallowed; the reload happens later, when the
 * user actually opens that page (lazyWithReload).
 */
export async function withoutAutoReload(task: () => Promise<unknown>): Promise<void> {
  quietDepth += 1
  try {
    await task()
  } catch {
    // ignored: see above
  } finally {
    quietDepth -= 1
  }
}

/** True once this page has started a reload for a new version. */
export function isReloadingForNewVersion(): boolean {
  return reloading
}

/**
 * Reload the page once to pick up a new deploy. Returns true if a reload is
 * under way (started now or earlier by this page), false if it was skipped:
 * offline (a reload would just show the browser's offline page) or already
 * tried within the last minute (so it can never loop).
 */
export function reloadOnceForNewVersion(): boolean {
  if (reloading) return true
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  const now = Date.now()
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (last && now - last < RELOAD_COOLDOWN_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(now))
  } catch {
    // Storage blocked (private mode): without a guard we can't rule out a
    // loop, so leave it to the Reload button.
    return false
  }
  reloading = true
  window.location.reload()
  return true
}

/**
 * React.lazy() that survives a deploy: if the page's code file is gone, the
 * page reloads once (onto the new version) instead of throwing into the
 * ErrorBoundary. While that reload is loading, the Suspense fallback stays up.
 */
export function lazyWithReload<T extends ComponentType<any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (isChunkLoadError(error) && reloadOnceForNewVersion()) {
        // Never settles: the page is about to be replaced.
        return new Promise<{ default: T }>(() => {})
      }
      throw error
    }),
  )
}

/**
 * Page-wide safety net for code loaded outside lazy() (e.g. a dynamic
 * `import('leaflet')` in an effect): Vite fires `vite:preloadError` when a
 * chunk or its CSS fails to load, and unhandled import failures surface as
 * `unhandledrejection`. Either one triggers the same single reload.
 * Call once at startup.
 */
export function installStaleDeployReload() {
  window.addEventListener('vite:preloadError', () => {
    // Don't preventDefault: callers (lazyWithReload, ErrorBoundary) still
    // see the error and keep their loading state while the reload lands.
    if (quietDepth === 0) reloadOnceForNewVersion()
  })
  window.addEventListener('unhandledrejection', event => {
    if (quietDepth === 0 && isChunkLoadError(event.reason)) reloadOnceForNewVersion()
  })
}

/** Test helper: forget the in-memory "reload under way" flag. */
export function _resetStaleDeployForTests() {
  reloading = false
}
