import { useRef } from 'react'

/**
 * Threshold-based horizontal swipe detection for photo carousels.
 * Mirrors the proven touchstart/touchend pattern in ui/PhotoLightbox.tsx:
 * only a predominantly-horizontal swipe past the threshold navigates, so
 * vertical page scrolling is never hijacked. No animation is introduced,
 * so prefers-reduced-motion needs no special handling here.
 */
const SWIPE_THRESHOLD_PX = 50

export function useCarouselSwipe(onPrev: () => void, onNext: () => void) {
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null

    // Horizontal swipe only (must be more horizontal than vertical to count)
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) onPrev()
      else onNext()
    }
  }

  return { onTouchStart, onTouchEnd }
}
