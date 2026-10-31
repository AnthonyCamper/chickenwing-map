import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardViewport } from './useKeyboardViewport'

class FakeVisualViewport extends EventTarget {
  offsetTop = 0
  height = 800
}

function installViewport(innerHeight: number) {
  const vv = new FakeVisualViewport()
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true })
  return vv
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useKeyboardViewport', () => {
  it('is null while no text field has focus', () => {
    installViewport(800)
    const { result } = renderHook(() => useKeyboardViewport())
    expect(result.current).toBeNull()
  })

  it('follows the visual viewport while a text field has focus', () => {
    const vv = installViewport(800)
    const input = document.createElement('input')
    document.body.appendChild(input)
    const { result } = renderHook(() => useKeyboardViewport())

    act(() => { input.focus() })
    expect(result.current).toEqual({ top: 0, height: 800 })

    act(() => {
      vv.height = 450
      vv.offsetTop = 30
      vv.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toEqual({ top: 30, height: 450 })

    act(() => { input.blur() })
    expect(result.current).toBeNull()
  })

  it('ignores innerHeight (iOS 26 Safari reports one that does not match the screen)', () => {
    const vv = installViewport(1400)
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    const { result } = renderHook(() => useKeyboardViewport())
    act(() => {
      textarea.focus()
      vv.height = 300
      vv.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toEqual({ top: 0, height: 300 })
  })

  it('does nothing for buttons or when disabled', () => {
    installViewport(800)
    const button = document.createElement('button')
    const input = document.createElement('input')
    document.body.append(button, input)
    const { result } = renderHook(() => useKeyboardViewport())
    act(() => { button.focus() })
    expect(result.current).toBeNull()

    const disabled = renderHook(() => useKeyboardViewport(false))
    act(() => { input.focus() })
    expect(disabled.result.current).toBeNull()
  })
})
