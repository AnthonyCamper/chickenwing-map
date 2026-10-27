import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import RatingPicker from './RatingPicker'

// jsdom has no PointerEvent; fireEvent would fall back to a plain Event and
// drop clientX.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
      }
    }
    ;(window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill
  }
})

// Lay out 10 stars 24px wide with 8px gaps from x=0, like the real track.
function layoutStars(track: HTMLElement) {
  track.getBoundingClientRect = () => ({ left: 0, width: 320, right: 320, top: 0, bottom: 40, height: 40, x: 0, y: 0, toJSON: () => ({}) })
  track.querySelectorAll<HTMLElement>('[data-star]').forEach((el, i) => {
    const left = i * 32
    el.getBoundingClientRect = () => ({ left, width: 24, right: left + 24, top: 0, bottom: 24, height: 24, x: left, y: 0, toJSON: () => ({}) })
  })
}

function Harness({ onChange }: { onChange?: (v: number) => void }) {
  const [v, setV] = useState(0)
  return <RatingPicker value={v} onChange={n => { setV(n); onChange?.(n) }} label="Wing rating" />
}

describe('RatingPicker', () => {
  it('tapping the 8th star sets exactly 8', () => {
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: 'Wing rating' })
    layoutStars(slider)
    const centerOf8th = 7 * 32 + 12
    fireEvent.pointerDown(slider, { clientX: centerOf8th, pointerId: 1 })
    fireEvent.pointerUp(slider, { clientX: centerOf8th, pointerId: 1 })
    expect(slider).toHaveAttribute('aria-valuenow', '8')
  })

  it('tapping near the right edge of a star still picks that star', () => {
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: 'Wing rating' })
    layoutStars(slider)
    fireEvent.pointerDown(slider, { clientX: 8 * 32 + 23, pointerId: 1 }) // right edge of star 9
    expect(slider).toHaveAttribute('aria-valuenow', '9')
  })

  it('a small wobble during a tap does not turn it into a decimal', () => {
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: 'Wing rating' })
    layoutStars(slider)
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(slider, { clientX: 103, pointerId: 1 })
    fireEvent.pointerUp(slider, { clientX: 103, pointerId: 1 })
    expect(slider).toHaveAttribute('aria-valuenow', '4')
  })

  it('dragging still allows decimals', () => {
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: 'Wing rating' })
    layoutStars(slider)
    fireEvent.pointerDown(slider, { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(slider, { clientX: 240, pointerId: 1 }) // 240/320 * 10 = 7.5
    fireEvent.pointerUp(slider, { clientX: 240, pointerId: 1 })
    expect(slider).toHaveAttribute('aria-valuenow', '7.5')
  })

  it('arrow keys and the buttons adjust by 0.1 and 1', () => {
    render(<Harness />)
    const slider = screen.getByRole('slider', { name: 'Wing rating' })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    expect(slider).toHaveAttribute('aria-valuenow', '1')
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 0.1' }))
    expect(slider).toHaveAttribute('aria-valuenow', '1.1')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(slider).toHaveAttribute('aria-valuenow', '1.2')
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true })
    expect(slider).toHaveAttribute('aria-valuenow', '2.2')
  })

  it('explains the scale in plain words', () => {
    render(<Harness onChange={vi.fn()} />)
    expect(screen.getByText(/1 = bad, 10 = best/)).toBeInTheDocument()
    expect(screen.queryByText(/drag • tap/)).not.toBeInTheDocument()
  })
})
