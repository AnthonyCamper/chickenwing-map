import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useDragCarousel } from './useDragCarousel'

function Harness({ count, index, onChange }: { count: number; index: number; onChange: (i: number) => void }) {
  const { containerProps, trackStyle, dragging } = useDragCarousel(count, index, onChange)
  return (
    <div data-testid="surface" data-dragging={dragging} {...containerProps}>
      <div data-testid="track" style={trackStyle} />
    </div>
  )
}

function touch(x: number, y: number) {
  return { clientX: x, clientY: y }
}

/** jsdom clientWidth is 0; the hook clamps width to >= 1, so distance-based
 *  advances trigger with any dx — velocity/axis behavior is what we assert. */
describe('useDragCarousel', () => {
  it('advances on a horizontal drag past the distance threshold', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    fireEvent.touchStart(s, { touches: [touch(200, 100)] })
    fireEvent.touchMove(s, { touches: [touch(120, 104)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(120, 104)] })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('goes back on a rightward drag', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={1} onChange={onChange} />)
    const s = getByTestId('surface')
    fireEvent.touchStart(s, { touches: [touch(100, 100)] })
    fireEvent.touchMove(s, { touches: [touch(180, 96)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(180, 96)] })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('ignores a vertical-dominant gesture', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    fireEvent.touchStart(s, { touches: [touch(100, 100)] })
    fireEvent.touchMove(s, { touches: [touch(110, 220)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(110, 220)] })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('never advances past the ends', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    // rightward drag at index 0 → rubber-band, no index change
    fireEvent.touchStart(s, { touches: [touch(100, 100)] })
    fireEvent.touchMove(s, { touches: [touch(220, 100)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(220, 100)] })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('is inert when count < 2', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={1} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    fireEvent.touchStart(s, { touches: [touch(200, 100)] })
    fireEvent.touchMove(s, { touches: [touch(80, 100)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(80, 100)] })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('tracks the finger while dragging and snaps with a transition on release', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    const track = getByTestId('track')
    fireEvent.touchStart(s, { touches: [touch(200, 100)] })
    fireEvent.touchMove(s, { touches: [touch(150, 100)] })
    expect(s.dataset.dragging).toBe('true')
    expect(track.style.transition).toBe('none')
    expect(track.style.transform).toContain('-50px')
    fireEvent.touchEnd(s, { changedTouches: [touch(150, 100)] })
    expect(s.dataset.dragging).toBe('false')
    expect(track.style.transition).toContain('250ms')
    expect(track.style.transform).toContain('+ 0px')
  })

  it('resets cleanly when the gesture is cancelled', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    const track = getByTestId('track')
    fireEvent.touchStart(s, { touches: [touch(200, 100)] })
    fireEvent.touchMove(s, { touches: [touch(150, 100)] })
    expect(s.dataset.dragging).toBe('true')
    fireEvent.touchCancel(s)
    expect(s.dataset.dragging).toBe('false')
    expect(track.style.transition).toContain('250ms')
    expect(track.style.transform).toContain('+ 0px')
    expect(onChange).not.toHaveBeenCalled()
  })
})
