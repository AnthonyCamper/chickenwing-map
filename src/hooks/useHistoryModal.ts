import { useEffect, useRef } from 'react'

/**
 * Pushes a browser history entry when a modal opens, so that the browser
 * back button / swipe-back gesture closes the modal instead of navigating away.
 *
 * Handles two close paths:
 * 1. Browser back (popstate) → calls onClose
 * 2. App close (X button, Escape) → calls history.back() to clean up the entry
 */
export function useHistoryModal(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const pushedRef = useRef(false)
  const closingViaAppRef = useRef(false)

  // Push / pop history entry in sync with modal state
  useEffect(() => {
    if (isOpen && !pushedRef.current) {
      pushedRef.current = true
      window.history.pushState({ _modal: true }, '')
    }
    if (!isOpen && pushedRef.current) {
      pushedRef.current = false
      closingViaAppRef.current = true
      window.history.back()
    }
  }, [isOpen])

  // Listen for browser-initiated back navigation
  useEffect(() => {
    const handler = () => {
      if (closingViaAppRef.current) {
        // This popstate was triggered by our own history.back() call — ignore it
        closingViaAppRef.current = false
        return
      }
      if (pushedRef.current) {
        // User pressed back / swiped back while modal was open
        pushedRef.current = false
        onCloseRef.current()
      }
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])
}
