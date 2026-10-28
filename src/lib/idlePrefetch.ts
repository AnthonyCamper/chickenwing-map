import { withoutAutoReload } from './staleDeploy'

type Loader = () => Promise<unknown>

interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

/**
 * Once the first page has finished loading and the browser is idle, download
 * the code for the pages a visitor is likely to open next, one at a time, so
 * those taps don't wait 3–7 s for a code file on a slow connection. Uses the
 * same import() calls as the lazy routes, so a prefetched page opens from the
 * module cache. Skipped when the user asked to save data or is on 2G.
 */
export function prefetchWhenIdle(loaders: Loader[], { delayMs = 1500 } = {}) {
  if (typeof window === 'undefined') return
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return

  const idle = (cb: () => void) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb, { timeout: 5000 })
    else setTimeout(cb, 200) // Safari has no requestIdleCallback
  }

  const run = async () => {
    for (const load of loaders) {
      await withoutAutoReload(load)
      // Yield between files so a tap in the meantime isn't held up.
      await new Promise<void>(resolve => idle(resolve))
    }
  }

  const start = () => window.setTimeout(() => idle(() => { void run() }), delayMs)
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
