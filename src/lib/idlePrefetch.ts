import { withoutAutoReload } from './staleDeploy'

type Loader = () => Promise<unknown>

interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

/** True while a photo on (or just below) the screen is still downloading. */
export function screenImagesPending(doc: Document = document, viewportH: number = window.innerHeight): boolean {
  for (const img of Array.from(doc.images)) {
    if (img.complete || !img.currentSrc && !img.getAttribute('src')) continue
    if (img.loading === 'lazy' && !img.currentSrc) continue // not requested yet
    const r = img.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.bottom > 0 && r.top < viewportH * 1.5) return true
  }
  return false
}

/** True while the page still shows a loading skeleton (its data is on the way). */
function pageStillLoading(doc: Document = document): boolean {
  return doc.querySelector('main [role="status"]') !== null
}

/** Resolve once the page's data and on-screen photos have loaded (or after maxWaitMs). */
function whenScreenSettled(maxWaitMs = 20000): Promise<void> {
  const until = Date.now() + maxWaitMs
  return new Promise(resolve => {
    const check = () => {
      if ((!pageStillLoading() && !screenImagesPending()) || Date.now() > until) resolve()
      else window.setTimeout(check, 500)
    }
    check()
  })
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
      // The 'load' event fires before the feed's data and photos are even
      // requested, so also wait for the skeleton to go and the photos on
      // screen to finish:
      // on slow 3G these code files took bandwidth from the landing photo,
      // the page's largest paint (S26).
      await whenScreenSettled()
      await withoutAutoReload(load)
      // Yield between files so a tap in the meantime isn't held up.
      await new Promise<void>(resolve => idle(resolve))
    }
  }

  const start = () => window.setTimeout(() => idle(() => { void run() }), delayMs)
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}
