import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Traps keyboard focus inside a container while it's mounted and restores
 * focus to whatever was focused before (the element that opened the modal)
 * on unmount. Attach the returned ref to the modal's panel element, which
 * should carry `aria-modal="true"` so stacked traps can cooperate.
 *
 * The Tab handler lives on `document` (not the panel) so it still fires after
 * focus has somehow escaped the panel and can pull it back. When several
 * traps are mounted at once, only the one on the last `[aria-modal]` in the
 * DOM (the topmost modal) acts — the rest yield to it.
 *
 * @param active  when false the trap is inert (e.g. a nested lightbox is open)
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(active = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!active) return
    if (!ref.current) return
    const root: HTMLElement = ref.current

    const opener = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement,
      )

    // Move focus into the panel. Prefer the first real control; fall back to
    // the panel itself (needs tabindex=-1) so screen readers land inside.
    const first = focusables()[0]
    if (first) first.focus()
    else root.focus()

    // With several modals open, only one trap should act. Prefer the modal
    // that currently owns focus; if focus has escaped to the background, fall
    // back to the last [aria-modal] in the DOM.
    function shouldAct() {
      const modals = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]'))
      if (modals.length <= 1) return true
      const owning = modals.find(m => m.contains(document.activeElement))
      return owning ? owning === root : modals[modals.length - 1] === root
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !shouldAct()) return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        root.focus()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const activeEl = document.activeElement as HTMLElement
      const outside = !root.contains(activeEl)

      if (e.shiftKey) {
        if (outside || activeEl === firstEl) {
          e.preventDefault()
          lastEl.focus()
        }
      } else if (outside || activeEl === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // Restore focus to the opener if it's still in the document
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [active])

  return ref
}
