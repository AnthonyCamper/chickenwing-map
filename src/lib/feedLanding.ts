import { useEffect, useState } from 'react'

// On the feed, the first card's photo is the landing page's largest paint.
// On slow 3G everything that downloads at the same time — the other feed
// photos, the Spots/Map data — shares the connection with it: with all of
// that in flight the photo took ~56 s to show (S26). This module records when
// that photo is done, so the rest can wait its turn.

/** Never hold other work back longer than this after page start. */
export const FEED_LANDING_MAX_WAIT_MS = 20_000

let settled = false
const waiters = new Set<() => void>()

/** The landing photo has loaded or failed, or the feed has no photo to wait for. */
export function markFeedLandingSettled() {
  if (settled) return
  settled = true
  const queued = [...waiters]
  waiters.clear()
  queued.forEach(fn => fn())
}

export function isFeedLandingSettled() {
  return settled
}

/**
 * Calls `cb` once the landing photo is done, or at the latest
 * FEED_LANDING_MAX_WAIT_MS after page start. Returns a cancel function.
 */
export function onFeedLandingSettled(cb: () => void): () => void {
  if (settled) {
    cb()
    return () => {}
  }
  let done = false
  const fire = () => {
    if (done) return
    done = true
    waiters.delete(fire)
    window.clearTimeout(timer)
    cb()
  }
  waiters.add(fire)
  const remaining = Math.max(0, FEED_LANDING_MAX_WAIT_MS - performance.now())
  const timer = window.setTimeout(fire, remaining)
  return () => {
    done = true
    waiters.delete(fire)
    window.clearTimeout(timer)
  }
}

/** True once the landing photo is done (or the wait timed out). */
export function useFeedLandingSettled(): boolean {
  const [done, setDone] = useState(settled)
  useEffect(() => {
    if (done) return
    return onFeedLandingSettled(() => setDone(true))
  }, [done])
  return done
}

/** Runs `cb` when the browser is idle (Safari: shortly). Returns a cancel function. */
export function whenIdle(cb: () => void, timeoutMs = 3000): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => cb(), { timeout: timeoutMs })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(cb, 200)
  return () => window.clearTimeout(id)
}

interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

/**
 * False when the browser says the connection is slow (2G/3G) or the user
 * asked to save data. Unknown (Safari, Firefox) counts as fast.
 */
export function isFastConnection(): boolean {
  if (typeof navigator === 'undefined') return true
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  if (!conn) return true
  if (conn.saveData) return false
  return !/(^|-)[23]g$/.test(conn.effectiveType ?? '')
}

/** Test helper: back to "landing photo not loaded yet". */
export function _resetFeedLandingForTests() {
  settled = false
  waiters.clear()
}
