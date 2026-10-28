import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  REVEAL_HANDLED_ATTR,
  handlesItsOwnReveal,
  installKeyboardReveal,
  isKeyboardField,
  nearbySubmitButton,
  revealFieldAboveKeyboard,
} from './keyboardReveal'

function rect(top: number, height: number, left = 16, width = 300): DOMRect {
  return { top, bottom: top + height, left, right: left + width, width, height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

function place(el: Element, top: number, height: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect(top, height))
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('isKeyboardField', () => {
  it('is true for text inputs and textareas, false for buttons, checkboxes and read-only fields', () => {
    document.body.innerHTML = `
      <input id="a" type="text"><input id="b" type="email"><textarea id="c"></textarea>
      <input id="d" type="checkbox"><input id="e" type="date"><input id="f" readonly><button id="g"></button>`
    const $ = (id: string) => document.getElementById(id)
    expect(['a', 'b', 'c'].map(id => isKeyboardField($(id)))).toEqual([true, true, true])
    expect(['d', 'e', 'f', 'g'].map(id => isKeyboardField($(id)))).toEqual([false, false, false, false])
  })
})

describe('opt-out', () => {
  it('skips fields inside [data-reveal-handled]', () => {
    document.body.innerHTML = `<div ${REVEAL_HANDLED_ATTR}><textarea id="t"></textarea></div><textarea id="u"></textarea>`
    expect(handlesItsOwnReveal(document.getElementById('t')!)).toBe(true)
    expect(handlesItsOwnReveal(document.getElementById('u')!)).toBe(false)
  })
})

describe('revealFieldAboveKeyboard', () => {
  it('scrolls a field near the bottom up so it and its Post button clear the (assumed) keyboard', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(667)
    document.body.innerHTML = `<form><textarea id="t"></textarea><button type="submit">Post</button></form>`
    const field = document.getElementById('t')!
    place(field, 480, 76)
    place(document.querySelector('button')!, 564, 44)
    expect(nearbySubmitButton(field)).toBe(document.querySelector('button'))
    const scrollBy = vi.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    revealFieldAboveKeyboard(field)
    // keyboard assumed over the bottom 260px: visible bottom = 667 - 8 - 260 = 399
    expect(scrollBy).toHaveBeenCalledWith({ top: 608 - 399, behavior: 'auto' })
  })

  it('leaves a field that is already visible alone', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(667)
    document.body.innerHTML = `<input id="i">`
    const field = document.getElementById('i')!
    place(field, 200, 52)
    const scrollBy = vi.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    revealFieldAboveKeyboard(field)
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('keeps the field top visible when field + button are taller than the space', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(667)
    document.body.innerHTML = `<form><textarea id="t"></textarea><button type="submit">Save</button></form>`
    const field = document.getElementById('t')!
    place(field, 500, 500)
    place(document.querySelector('button')!, 1010, 44)
    const scrollBy = vi.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    revealFieldAboveKeyboard(field)
    // can't fit: the field's top goes to the top of the visible area (8px gap)
    expect(scrollBy).toHaveBeenCalledWith({ top: 500 - 8, behavior: 'auto' })
  })
})

describe('installKeyboardReveal', () => {
  it('does nothing on a desktop (fine pointer)', async () => {
    document.body.innerHTML = `<textarea id="t"></textarea>`
    const field = document.getElementById('t') as HTMLTextAreaElement
    place(field, 600, 60)
    const scrollBy = vi.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    const uninstall = installKeyboardReveal()
    field.focus()
    await new Promise(r => setTimeout(r, 450))
    expect(scrollBy).not.toHaveBeenCalled()
    uninstall()
  })

  it('reveals on focus on a touch screen, but not inside [data-reveal-handled]', async () => {
    const mm = window.matchMedia
    window.matchMedia = ((q: string) => ({ ...mm(q), matches: q.includes('coarse') })) as typeof window.matchMedia
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(667)
    document.body.innerHTML = `<textarea id="t"></textarea><div ${REVEAL_HANDLED_ATTR}><textarea id="h"></textarea></div>`
    const field = document.getElementById('t') as HTMLTextAreaElement
    const handled = document.getElementById('h') as HTMLTextAreaElement
    place(field, 600, 60)
    place(handled, 600, 60)
    const scrollBy = vi.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    const uninstall = installKeyboardReveal()
    try {
      handled.focus()
      await new Promise(r => setTimeout(r, 450))
      expect(scrollBy).not.toHaveBeenCalled()
      field.focus()
      await new Promise(r => setTimeout(r, 450))
      expect(scrollBy).toHaveBeenCalled()
    } finally {
      uninstall()
      window.matchMedia = mm
    }
  })
})
