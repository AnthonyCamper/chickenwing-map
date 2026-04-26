import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBottomSheetDrag } from './useBottomSheetDrag'

// Default to mobile viewport
beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
})

function touch(clientY: number) {
  return { touches: [{ clientY }] } as unknown as React.TouchEvent
}

describe('useBottomSheetDrag', () => {
  it('starts in collapsed state', () => {
    const { result } = renderHook(() => useBottomSheetDrag())
    expect(result.current.expanded).toBe(false)
  })

  it('toggles on click', () => {
    const { result } = renderHook(() => useBottomSheetDrag())

    act(() => result.current.handleProps.onClick())
    expect(result.current.expanded).toBe(true)

    act(() => result.current.handleProps.onClick())
    expect(result.current.expanded).toBe(false)
  })

  it('expands on upward swipe', () => {
    const { result } = renderHook(() => useBottomSheetDrag())

    act(() => result.current.handleProps.onTouchStart(touch(300)))
    act(() => result.current.handleProps.onTouchMove(touch(200))) // 100px up
    act(() => result.current.handleProps.onTouchEnd())

    expect(result.current.expanded).toBe(true)
  })

  it('collapses on downward swipe when expanded', () => {
    const { result } = renderHook(() => useBottomSheetDrag())

    // Expand first
    act(() => result.current.handleProps.onClick())
    expect(result.current.expanded).toBe(true)

    // Swipe down
    act(() => result.current.handleProps.onTouchStart(touch(200)))
    act(() => result.current.handleProps.onTouchMove(touch(300))) // 100px down
    act(() => result.current.handleProps.onTouchEnd())

    expect(result.current.expanded).toBe(false)
  })

  it('does not expand on small slow drag', () => {
    const now = vi.spyOn(Date, 'now')
    const { result } = renderHook(() => useBottomSheetDrag())

    now.mockReturnValue(1000)
    act(() => result.current.handleProps.onTouchStart(touch(300)))
    act(() => result.current.handleProps.onTouchMove(touch(290))) // only 10px up

    // Simulate 500ms elapsed so velocity = 10/500 = 0.02 (below threshold)
    now.mockReturnValue(1500)
    act(() => result.current.handleProps.onTouchEnd())

    expect(result.current.expanded).toBe(false)
    now.mockRestore()
  })

  it('applies expanded max-height on mobile when expanded', () => {
    const { result } = renderHook(() => useBottomSheetDrag())

    expect(result.current.sheetStyle.maxHeight).toContain('90dvh')

    act(() => result.current.handleProps.onClick())

    expect(result.current.sheetStyle.maxHeight).toContain('100dvh')
  })

  it('uses custom default max-height', () => {
    const { result } = renderHook(() =>
      useBottomSheetDrag({ defaultMaxHeight: '60dvh' })
    )
    expect(result.current.sheetStyle.maxHeight).toBe('60dvh')
  })

  it('uses static max-height on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })

    const { result } = renderHook(() => useBottomSheetDrag())

    // On desktop, always uses default max-height regardless of expanded state
    const defaultHeight = result.current.sheetStyle.maxHeight

    act(() => result.current.handleProps.onClick())

    expect(result.current.sheetStyle.maxHeight).toBe(defaultHeight)
  })

  it('applies transition when not dragging', () => {
    const { result } = renderHook(() => useBottomSheetDrag())
    const transition = result.current.sheetStyle.transition as string
    expect(transition).toContain('max-height')
    expect(transition).toContain('transform')
  })

  it('disables transition during active drag', () => {
    const { result } = renderHook(() => useBottomSheetDrag())

    act(() => result.current.handleProps.onTouchStart(touch(300)))
    act(() => result.current.handleProps.onTouchMove(touch(250)))

    expect(result.current.sheetStyle.transition).toBe('none')
  })

  it('applies dampened visual offset during drag', () => {
    const { result } = renderHook(() => useBottomSheetDrag())

    act(() => result.current.handleProps.onTouchStart(touch(300)))
    act(() => result.current.handleProps.onTouchMove(touch(200))) // -100 delta

    const transform = result.current.sheetStyle.transform as string
    // 100 * 0.15 = 15px offset (negative = up)
    expect(transform).toBe('translateY(-15px)')
  })

  it('resets visual offset after touch end', () => {
    const { result } = renderHook(() => useBottomSheetDrag())

    act(() => result.current.handleProps.onTouchStart(touch(300)))
    act(() => result.current.handleProps.onTouchMove(touch(200)))
    act(() => result.current.handleProps.onTouchEnd(touch(200) as unknown as React.TouchEvent))

    expect(result.current.sheetStyle.transform).toBe('translateY(0px)')
  })
})
