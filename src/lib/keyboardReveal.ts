import { revealDelta, stickyHeaderBottom } from '../components/gallery/revealAboveKeyboard'

/**
 * Global "keep the focused field above the on-screen keyboard" (S02).
 *
 * Phones don't reliably scroll a focused field clear of the keyboard (and
 * never its Post / Save button). On touch screens, when a text field gets
 * focus, this scrolls the field — plus its submit button when that sits just
 * below it, and its suggestion list (aria-controls) when there is one — into
 * the space between the sticky header and the keyboard. It scrolls the
 * field's own scrolling sheet when it's inside one, otherwise the page.
 *
 * Fields that already handle this themselves (CommentComposer, PhotoModal's
 * sheet — see components/gallery/revealAboveKeyboard) opt out by carrying, or
 * sitting inside an element with, the `data-reveal-handled` attribute.
 * Desktop (fine pointer) is left alone, and a field that is already fully
 * visible is never moved.
 */

/** Opt-out marker for fields/components that reveal themselves. */
export const REVEAL_HANDLED_ATTR = 'data-reveal-handled'

/** A phone keyboard covers about this much of a 667px-tall screen. */
const ASSUMED_KEYBOARD_PX = 260
/** visualViewport this much shorter than the layout viewport = keyboard is up. */
const KEYBOARD_MIN_PX = 120
const GAP_PX = 8
/** A submit button further below the field than this isn't "its" button. */
const BUTTON_MAX_GAP_PX = 120
/** Never try to keep more than this much in view above the field's top. */
const MAX_BLOCK_PX = 320

const NON_TEXT_INPUTS = new Set([
  'button', 'checkbox', 'color', 'date', 'datetime-local', 'file', 'hidden',
  'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week',
])

/** True for elements that bring up the on-screen keyboard. */
export function isKeyboardField(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) {
    return !NON_TEXT_INPUTS.has(el.type) && !el.readOnly && !el.disabled
  }
  return el.isContentEditable === true
}

function isTouchScreen(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p
  }
  return null
}

const SUBMIT_TEXT = /^\s*(post|reply|send|save|add|search|create|comment|update)\b/i

/** The Post / Save button that belongs to this field, if it sits just below it. */
export function nearbySubmitButton(field: HTMLElement): HTMLElement | null {
  const fr = field.getBoundingClientRect()
  const form = field.closest('form')
  let scope: HTMLElement | null = form
  if (!scope) {
    // No <form>: look a few levels up for a composer-sized container.
    scope = field.parentElement
    for (let i = 0; i < 3 && scope && !scope.querySelector('button'); i++) scope = scope.parentElement
  }
  if (!scope) return null
  const buttons = Array.from(scope.querySelectorAll<HTMLElement>('button, [type="submit"]'))
  let best: HTMLElement | null = null
  for (const b of buttons) {
    if (b === field || b.contains(field)) continue
    const r = b.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.top < fr.top - 4 || r.top - fr.bottom > BUTTON_MAX_GAP_PX) continue
    const isSubmit = b.getAttribute('type') === 'submit' || SUBMIT_TEXT.test(b.textContent ?? '')
    if (!isSubmit) continue
    if (!best || r.bottom > best.getBoundingClientRect().bottom) best = b
  }
  return best
}

/** The suggestion list a combobox-style field controls, when it's showing. */
function controlledList(field: HTMLElement): HTMLElement | null {
  const id = field.getAttribute('aria-controls') || field.getAttribute('aria-owns')
  if (!id) return null
  const el = document.getElementById(id.split(/\s+/)[0])
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.height > 0 ? el : null
}

/**
 * Scroll `field` (and its submit button / suggestions) into the visible area
 * between the sticky header and the keyboard. No-op when already visible.
 */
export function revealFieldAboveKeyboard(field: HTMLElement, opts: { smooth?: boolean } = {}): void {
  const vv = window.visualViewport
  const layoutH = window.innerHeight
  const visibleH = vv ? vv.height : layoutH
  let viewTop = Math.max(stickyHeaderBottom(), vv ? vv.offsetTop : 0) + GAP_PX
  let viewBottom = (vv ? vv.offsetTop + vv.height : layoutH) - GAP_PX

  const fieldRect = field.getBoundingClientRect()
  const keyboardUp = layoutH - visibleH > KEYBOARD_MIN_PX
  if (!keyboardUp) {
    // Keyboard still on its way: keep clear of where it will be.
    const reserve = Math.min(ASSUMED_KEYBOARD_PX, Math.round(layoutH * 0.4))
    viewBottom = Math.max(viewBottom - reserve, viewTop + fieldRect.height)
  }

  const sc = scrollParent(field)
  if (sc) {
    const r = sc.getBoundingClientRect()
    viewTop = Math.max(viewTop, r.top + GAP_PX)
    viewBottom = Math.min(viewBottom, r.bottom - GAP_PX)
  }

  // The block to keep visible: the field, stretched down to its button and
  // suggestion list — but never taller than the space or MAX_BLOCK_PX, so the
  // field's own top always stays on screen.
  let top = fieldRect.top
  let bottom = fieldRect.bottom
  for (const extra of [nearbySubmitButton(field), controlledList(field)]) {
    if (!extra) continue
    const r = extra.getBoundingClientRect()
    bottom = Math.max(bottom, Math.min(r.bottom, top + MAX_BLOCK_PX))
  }
  top = Math.min(top, bottom)
  bottom = Math.min(bottom, top + Math.max(fieldRect.height, viewBottom - viewTop))

  const delta = revealDelta(top, bottom, viewTop, viewBottom)
  if (Math.abs(delta) < 2) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const behavior: ScrollBehavior = opts.smooth && !reduceMotion ? 'smooth' : 'auto'
  if (sc) sc.scrollBy?.({ top: delta, behavior })
  else window.scrollBy?.({ top: delta, behavior })
}

/** Should the global handler leave this field alone? */
export function handlesItsOwnReveal(field: HTMLElement): boolean {
  return field.closest(`[${REVEAL_HANDLED_ATTR}]`) !== null
}

/**
 * Install the document-wide focus handler (once, from main.tsx). Returns an
 * uninstall function (tests).
 */
export function installKeyboardReveal(): () => void {
  if (typeof window === 'undefined') return () => {}
  let cleanupPending: (() => void) | null = null

  const onFocusIn = (e: FocusEvent) => {
    const field = e.target as Element | null
    if (!isKeyboardField(field) || !isTouchScreen() || handlesItsOwnReveal(field)) return
    cleanupPending?.()

    const vv = window.visualViewport
    let done = false
    const run = () => {
      if (document.activeElement !== field || !field.isConnected) return
      revealFieldAboveKeyboard(field, { smooth: true })
    }
    // Once now (keyboard still opening: assumes its height), again when the
    // keyboard has actually opened (visualViewport shrinks) or after a
    // fallback delay, and when suggestions show up while typing.
    const frame = requestAnimationFrame(run)
    const onResize = () => { if (!done) run() }
    vv?.addEventListener('resize', onResize)
    const fallback = window.setTimeout(run, 400)
    const stopListening = window.setTimeout(() => { done = true; vv?.removeEventListener('resize', onResize) }, 1200)
    let inputTimer = 0
    const onInput = () => {
      if (!field.getAttribute('aria-controls') && !field.getAttribute('aria-owns')) return
      window.clearTimeout(inputTimer)
      inputTimer = window.setTimeout(run, 250)
    }
    field.addEventListener('input', onInput)
    const onBlur = () => cleanupPending?.()
    field.addEventListener('blur', onBlur, { once: true })

    cleanupPending = () => {
      done = true
      cancelAnimationFrame(frame)
      window.clearTimeout(fallback)
      window.clearTimeout(stopListening)
      window.clearTimeout(inputTimer)
      vv?.removeEventListener('resize', onResize)
      field.removeEventListener('input', onInput)
      field.removeEventListener('blur', onBlur)
      cleanupPending = null
    }
  }

  document.addEventListener('focusin', onFocusIn)
  return () => {
    document.removeEventListener('focusin', onFocusIn)
    cleanupPending?.()
  }
}
