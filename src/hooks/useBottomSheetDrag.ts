import { useRef, useState, useCallback } from 'react'

const SNAP_THRESHOLD = 40   // px drag distance to trigger state change
const VELOCITY_THRESHOLD = 0.3 // px/ms swipe speed to trigger state change
const DAMPEN = 0.15           // visual feedback during drag (fraction of delta)
const DURATION = '0.35s'
const CURVE = 'cubic-bezier(0.32, 0.72, 0, 1)'

interface Options {
  /** CSS max-height for collapsed state. Default: 'calc(90dvh - env(safe-area-inset-top))' */
  defaultMaxHeight?: string
  /** CSS max-height for expanded state. Default: 'calc(100dvh - env(safe-area-inset-top))' */
  expandedMaxHeight?: string
}

/**
 * Two-state bottom sheet drag hook.
 *
 * Returns touch/click handlers for the drag handle and a style object
 * to apply on the sheet container. On desktop (>=640px) the sheet stays
 * at its default height with no drag behavior.
 */
export function useBottomSheetDrag(options?: Options) {
  const defaultMax = options?.defaultMaxHeight ?? 'calc(90dvh - env(safe-area-inset-top))'
  const expandedMax = options?.expandedMaxHeight ?? 'calc(100dvh - env(safe-area-inset-top))'

  const [expanded, setExpanded] = useState(false)
  const [dragDelta, setDragDelta] = useState(0)

  const startY = useRef(0)
  const startTime = useRef(0)
  const dragging = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    startTime.current = Date.now()
    dragging.current = true
    setDragDelta(0)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return
    setDragDelta(e.touches[0].clientY - startY.current)
  }, [])

  const handleTouchEnd = useCallback((_e?: React.TouchEvent) => {
    if (!dragging.current) return
    dragging.current = false

    const delta = dragDelta          // positive = down, negative = up
    const elapsed = Math.max(1, Date.now() - startTime.current)
    const velocity = delta / elapsed // px/ms

    setExpanded(prev => {
      if (prev) {
        // Expanded → collapse on downward swipe
        return !(delta > SNAP_THRESHOLD || velocity > VELOCITY_THRESHOLD)
      }
      // Collapsed → expand on upward swipe
      return delta < -SNAP_THRESHOLD || velocity < -VELOCITY_THRESHOLD
    })

    setDragDelta(0)
  }, [dragDelta])

  const handleClick = useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  // Only apply two-state behavior on mobile (<640px)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  const visualOffset = dragDelta !== 0 ? dragDelta * DAMPEN : 0
  const animating = dragDelta === 0 // apply transition only when not actively dragging

  const sheetStyle: React.CSSProperties = isMobile
    ? {
        maxHeight: expanded ? expandedMax : defaultMax,
        transform: `translateY(${visualOffset}px)`,
        transition: animating
          ? `max-height ${DURATION} ${CURVE}, transform ${DURATION} ${CURVE}`
          : 'none',
        willChange: dragDelta !== 0 ? 'transform' : undefined,
      }
    : { maxHeight: defaultMax }

  return {
    expanded,
    setExpanded,
    handleProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onClick: handleClick,
    },
    sheetStyle,
  }
}
