/**
 * Keep an element (a comment composer: text box + Post row) fully visible
 * between the sticky header and the on-screen keyboard.
 *
 * Right after focus the keyboard is not up yet, so on touch screens we
 * reserve ASSUMED_KEYBOARD_PX at the bottom until visualViewport reports the
 * real keyboard; callers run this again when it does.
 */

/** A phone keyboard covers about this much of a 667px-tall screen. */
const ASSUMED_KEYBOARD_PX = 260
/** visualViewport this much shorter than the layout viewport = keyboard is up. */
const KEYBOARD_MIN_PX = 120
const GAP_PX = 8

/** Bottom edge of the sticky/fixed page header (0 when there is none). */
export function stickyHeaderBottom(): number {
  let bottom = 0
  document.querySelectorAll('header').forEach(h => {
    const pos = getComputedStyle(h).position
    if (pos === 'sticky' || pos === 'fixed') bottom = Math.max(bottom, h.getBoundingClientRect().bottom)
  })
  return Math.max(0, bottom)
}

/**
 * How far to scroll (px, positive = down) so [top, bottom] fits inside
 * [viewTop, viewBottom]. When it can't fit, its top wins.
 */
export function revealDelta(top: number, bottom: number, viewTop: number, viewBottom: number): number {
  if (bottom > viewBottom) return Math.min(bottom - viewBottom, top - viewTop)
  if (top < viewTop) return top - viewTop
  return 0
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p
  }
  return null
}

export function revealAboveKeyboard(el: HTMLElement, opts: { smooth?: boolean } = {}): void {
  const vv = window.visualViewport
  const layoutH = window.innerHeight
  const visibleH = vv ? vv.height : layoutH
  let viewTop = Math.max(stickyHeaderBottom(), vv ? vv.offsetTop : 0) + GAP_PX
  let viewBottom = (vv ? vv.offsetTop + vv.height : layoutH) - GAP_PX

  const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const keyboardUp = layoutH - visibleH > KEYBOARD_MIN_PX
  if (touch && !keyboardUp) {
    // Keyboard still on its way: keep clear of where it will be, but never
    // squeeze the space to less than the element itself.
    const reserve = Math.min(ASSUMED_KEYBOARD_PX, Math.round(layoutH * 0.4))
    viewBottom = Math.max(viewBottom - reserve, viewTop + el.offsetHeight)
  }

  const sc = scrollParent(el)
  if (sc) {
    const r = sc.getBoundingClientRect()
    viewTop = Math.max(viewTop, r.top + GAP_PX)
    viewBottom = Math.min(viewBottom, r.bottom - GAP_PX)
  }

  const rect = el.getBoundingClientRect()
  const delta = revealDelta(rect.top, rect.bottom, viewTop, viewBottom)
  if (Math.abs(delta) < 2) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const behavior: ScrollBehavior = opts.smooth && !reduceMotion ? 'smooth' : 'auto'
  if (sc) sc.scrollBy?.({ top: delta, behavior })
  else window.scrollBy?.({ top: delta, behavior })
}
