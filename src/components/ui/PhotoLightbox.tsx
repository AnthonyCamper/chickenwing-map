import { useEffect, useRef, useState } from 'react'
import { useBackClosesOverlay } from '../../hooks/useBackClosesOverlay'
import { useHideFab } from '../../hooks/useHideFab'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface Props {
  /** `alt` describes the photo for screen readers (defaults to "Wing photo"). */
  photos: { id: string; url: string; alt?: string }[]
  initialIndex: number
  onClose: () => void
}

const SWIPE_THRESHOLD_PX = 50

// Solid dark circle + white icon: visible over light and dark photos alike.
const NAV_BTN = 'absolute z-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-night-900/70 hover:bg-night-900/90 ring-1 ring-white/40 shadow-lg text-white flex items-center justify-center transition-colors disabled:opacity-0 disabled:pointer-events-none'

function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}

export default function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  // Keyboard focus stays in the viewer and returns to the opener on close
  const dialogRef = useFocusTrap<HTMLDivElement>()

  // Browser Back closes the viewer instead of leaving the page
  useBackClosesOverlay(onClose)
  useHideFab(true)

  useEffect(() => {
    // iOS-safe scroll lock with position preservation
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex(i => Math.min(photos.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photos.length, onClose])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    const dx = endX - touchStartX.current
    const dy = endY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null

    // Horizontal swipe (must be more horizontal than vertical to count)
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && index > 0) setIndex(i => i - 1)
      else if (dx < 0 && index < photos.length - 1) setIndex(i => i + 1)
    }
    // Downward swipe closes
    else if (dy > SWIPE_THRESHOLD_PX * 1.5 && Math.abs(dy) > Math.abs(dx)) {
      onClose()
    }
  }

  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={photos.length > 1 ? `Photo viewer, photo ${index + 1} of ${photos.length}` : 'Photo viewer'}
      className="fixed inset-0 z-[150] bg-night-900/95 flex items-center justify-center p-4"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close photo"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))', right: 'calc(1rem + env(safe-area-inset-right))' }}
        className="absolute z-10 w-12 h-12 rounded-full bg-night-900/70 hover:bg-night-900/90 ring-1 ring-white/40 shadow-lg text-white text-2xl leading-none flex items-center justify-center transition-colors"
      >
        ×
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIndex(i => Math.max(0, i - 1)) }}
            disabled={index === 0}
            aria-label="Previous photo"
            className={`${NAV_BTN} left-4`}
          >
            <ChevronIcon dir="left" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIndex(i => Math.min(photos.length - 1, i + 1)) }}
            disabled={index === photos.length - 1}
            aria-label="Next photo"
            className={`${NAV_BTN} right-4`}
          >
            <ChevronIcon dir="right" />
          </button>

          <span
            aria-hidden="true"
            className="absolute left-1/2 -translate-x-1/2 text-cream-50/80 text-xs font-bold uppercase tracking-crowd"
            style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {index + 1} / {photos.length}
          </span>
        </>
      )}

      <img
        src={photo.url}
        alt={photo.alt || 'Wing photo'}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
      />
    </div>
  )
}
