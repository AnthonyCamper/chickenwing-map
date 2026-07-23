import { useRef, useState } from 'react'

const AXIS_LOCK_PX = 6          // gesture axis decided after this much travel
const FLICK_VELOCITY = 0.3      // px/ms — a fast flick advances even on a short drag
const DISTANCE_FRACTION = 0.2   // dragging past 20% of the container width advances
const EDGE_RESISTANCE = 0.35    // rubber-band factor when dragging past the ends

/**
 * Instagram-style drag carousel: the track follows the finger (axis-locked so
 * vertical page scroll is never hijacked), rubber-bands at the ends, and on
 * release either advances (far drag or fast flick) or snaps back. Reduced
 * motion is handled by the global transition kill-switch in index.css, which
 * overrides the inline snap transition.
 */
export function useDragCarousel(count: number, index: number, onIndexChange: (i: number) => void) {
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  const width = useRef(1)

  const onTouchStart = (e: React.TouchEvent) => {
    if (count < 2) return
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp }
    axis.current = null
    width.current = Math.max(1, (e.currentTarget as HTMLElement).clientWidth)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return
    const dx = e.touches[0].clientX - start.current.x
    const dy = e.touches[0].clientY - start.current.y
    if (axis.current === null && (Math.abs(dx) > AXIS_LOCK_PX || Math.abs(dy) > AXIS_LOCK_PX)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (axis.current === 'h') setDragging(true)
    }
    if (axis.current !== 'h') return
    const pastStart = index === 0 && dx > 0
    const pastEnd = index === count - 1 && dx < 0
    setDragPx(pastStart || pastEnd ? dx * EDGE_RESISTANCE : dx)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return
    const dx = e.changedTouches[0].clientX - start.current.x
    const dt = Math.max(1, e.timeStamp - start.current.t)
    const horizontal = axis.current === 'h'
    start.current = null
    axis.current = null
    setDragging(false)
    setDragPx(0)
    if (!horizontal) return
    const flick = Math.abs(dx) / dt > FLICK_VELOCITY
    const far = Math.abs(dx) > width.current * DISTANCE_FRACTION
    if (!flick && !far) return
    if (dx < 0 && index < count - 1) onIndexChange(index + 1)
    else if (dx > 0 && index > 0) onIndexChange(index - 1)
  }

  return {
    containerProps: { onTouchStart, onTouchMove, onTouchEnd },
    trackStyle: {
      transform: `translateX(calc(-${index * 100}% + ${dragPx}px))`,
      transition: dragging ? 'none' : 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)',
    } as React.CSSProperties,
    dragging,
  }
}
