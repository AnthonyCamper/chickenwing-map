import { useEffect, useRef } from 'react'

/**
 * Pushes a browser history entry when a modal opens, so that the browser
 * back button / swipe-back gesture closes the modal instead of navigating away.
 *
 * Handles two close paths:
 * 1. Browser back (popstate) → calls onClose
 * 2. App close (X button, Escape) → calls history.back() to clean up the entry
 */
export function useHistoryModal(
  isOpen: boolean,
  onClose: () => void,
  /** Optional guard for browser Back: return false to keep the modal open
   *  (e.g. after asking to confirm discarding unsaved edits). The history
   *  entry is pushed again so the next Back is caught too. */
  canClose?: () => boolean,
) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const canCloseRef = useRef(canClose)
  canCloseRef.current = canClose

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

  // If the host component unmounts while the modal is still open, pop the
  // pushed entry too — otherwise the next back press is a silent no-op.
  useEffect(() => () => {
    if (pushedRef.current) {
      pushedRef.current = false
      closingViaAppRef.current = true
      window.history.back()
    }
  }, [])

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
        if (canCloseRef.current && !canCloseRef.current()) {
          // Stay open: put our entry back so history matches what's shown
          window.history.pushState({ _modal: true }, '')
          return
        }
        pushedRef.current = false
        onCloseRef.current()
      }
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])
}
