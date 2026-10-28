import { useEffect, useRef } from 'react'

/**
 * Browser Back / swipe-back closes a full-screen overlay (photo lightbox)
 * instead of leaving the page. Call it from a component that is only mounted
 * while the overlay is open.
 *
 * Unlike useHistoryModal this is stack-aware, so it works when the overlay
 * opens on top of another history-backed modal (e.g. the lightbox inside
 * PhotoModal): one Back press closes only the top-most overlay, and closing
 * it with × doesn't make the modal underneath think Back was pressed.
 */

const stack: symbol[] = []
/** popstates caused by our own history.back() that nobody else should see */
let swallowPops = 0
let listening = false

function ensureSwallowListener() {
  if (listening) return
  listening = true
  // Capture listeners on window run before the bubbling ones other code
  // (useHistoryModal, React Router) registers, so we can hide our own pops.
  window.addEventListener('popstate', e => {
    if (swallowPops > 0) {
      swallowPops -= 1
      e.stopImmediatePropagation()
    }
  }, true)
}

export function useBackClosesOverlay(onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const tokenRef = useRef<symbol | null>(null)
  const closedByBackRef = useRef(false)
  // Dropping our history entry is deferred one tick so React StrictMode's
  // dev-only unmount/remount doesn't pop and re-push it (which corrupts the
  // history stack); a real unmount lets the timer run.
  const pendingPopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ensureSwallowListener()
    if (pendingPopRef.current) {
      // Remounted straight away (StrictMode): keep the entry we already pushed
      clearTimeout(pendingPopRef.current)
      pendingPopRef.current = null
    } else {
      closedByBackRef.current = false
      // Keep the router's state on the new entry so its location stays the same
      window.history.pushState({ ...(window.history.state ?? {}), _overlay: true }, '')
    }
    const token = tokenRef.current ?? Symbol('overlay')
    tokenRef.current = token
    stack.push(token)

    const onPop = (e: PopStateEvent) => {
      if (swallowPops > 0) return
      if (stack[stack.length - 1] !== token) return
      closedByBackRef.current = true
      // Only the top overlay closes; the modal underneath stays open.
      e.stopImmediatePropagation()
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPop, true)

    return () => {
      window.removeEventListener('popstate', onPop, true)
      const i = stack.indexOf(token)
      if (i >= 0) stack.splice(i, 1)
      if (closedByBackRef.current) return
      pendingPopRef.current = setTimeout(() => {
        pendingPopRef.current = null
        // Closed in the app (×, Escape, tap): drop the entry we pushed,
        // silently, so the next Back press does what the user expects.
        swallowPops += 1
        window.history.back()
      }, 0)
    }
  }, [])
}
