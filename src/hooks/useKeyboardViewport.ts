import { useEffect, useState } from 'react'
import { isKeyboardField } from '../lib/keyboardReveal'

export interface ViewportBox {
  /** Distance of the visible area's top from the top of a `position: fixed` box. */
  top: number
  /** Height of the visible area (what the on-screen keyboard leaves). */
  height: number
}

/**
 * Where the visible part of the screen is while a text field has focus, so a
 * bottom sheet can be pinned to it instead of to the layout viewport, which
 * the iOS keyboard covers. Null when no text field has focus (or `enabled`
 * is false), and then the sheet keeps its normal layout.
 *
 * Measured from window.visualViewport alone: its offsetTop/height are in the
 * same coordinates `position: fixed` uses. Don't estimate the keyboard as
 * `innerHeight - visualViewport.height` — on iOS 26 Safari innerHeight and
 * 100dvh don't track the fixed box (floating toolbar, keyboard), the estimate
 * came out far too big, and the Add a review sheet was lifted half-way up the
 * screen and squeezed until its fields vanished.
 */
export function useKeyboardViewport(enabled = true): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null)
  useEffect(() => {
    const vv = window.visualViewport
    if (!enabled || !vv) {
      setBox(null)
      return
    }
    let focused = isKeyboardField(document.activeElement)
    const update = () => {
      if (!focused) {
        setBox(null)
        return
      }
      const top = Math.round(vv.offsetTop)
      const height = Math.round(vv.height)
      setBox(prev => (prev && prev.top === top && prev.height === height ? prev : { top, height }))
    }
    const onFocusIn = (e: FocusEvent) => {
      focused = isKeyboardField(e.target as Element | null)
      update()
    }
    // During focusout activeElement is not yet the next element; relatedTarget is.
    const onFocusOut = (e: FocusEvent) => {
      focused = isKeyboardField(e.relatedTarget as Element | null)
      update()
    }
    update()
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])
  return box
}
