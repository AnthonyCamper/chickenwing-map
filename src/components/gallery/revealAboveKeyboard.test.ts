import { describe, it, expect, vi, afterEach } from 'vitest'
import { revealDelta, revealAboveKeyboard } from './revealAboveKeyboard'

describe('revealDelta', () => {
  it('scrolls down just enough to show the bottom', () => {
    expect(revealDelta(600, 700, 74, 399)).toBe(301)
  })
  it('never pushes the top under the header when it does not fit', () => {
    expect(revealDelta(100, 600, 74, 399)).toBe(26)
    expect(revealDelta(40, 600, 74, 399)).toBe(-34)
  })
  it('scrolls up when the top is under the header, and not at all when visible', () => {
    expect(revealDelta(20, 120, 74, 399)).toBe(-54)
    expect(revealDelta(200, 300, 74, 399)).toBe(0)
  })
})

describe('revealAboveKeyboard', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('on a touch screen keeps the composer clear of the keyboard that is about to open', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(q => ({ matches: q === '(pointer: coarse)' } as MediaQueryList))
    Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true })
    const scrollBy = vi.fn()
    window.scrollBy = scrollBy as unknown as typeof window.scrollBy
    const el = document.createElement('div')
    document.body.appendChild(el)
    el.getBoundingClientRect = () => ({ top: 560, bottom: 660, left: 0, right: 375, width: 375, height: 100, x: 0, y: 560, toJSON: () => ({}) })
    revealAboveKeyboard(el)
    // bottom 660 → must end at 667 - 8 - 260 = 399
    expect(scrollBy).toHaveBeenCalledWith({ top: 261, behavior: 'auto' })
    el.remove()
  })
})
