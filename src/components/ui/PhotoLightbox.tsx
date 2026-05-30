import { useEffect, useRef, useState } from 'react'

interface Props {
  photos: { id: string; url: string }[]
  initialIndex: number
  onClose: () => void
}

const SWIPE_THRESHOLD_PX = 50

export default function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

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
      className="fixed inset-0 z-[150] bg-night-900/95 flex items-center justify-center p-4"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))', right: 'calc(1rem + env(safe-area-inset-right))' }}
        className="absolute w-11 h-11 rounded-full bg-cream-50/10 hover:bg-cream-50/20 text-cream-50 text-2xl leading-none flex items-center justify-center transition-colors"
      >
        ×
      </button>

      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIndex(i => Math.max(0, i - 1)) }}
            disabled={index === 0}
            aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-cream-50/10 hover:bg-cream-50/20 disabled:opacity-30 disabled:cursor-not-allowed text-cream-50 text-2xl flex items-center justify-center transition-colors"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIndex(i => Math.min(photos.length - 1, i + 1)) }}
            disabled={index === photos.length - 1}
            aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-cream-50/10 hover:bg-cream-50/20 disabled:opacity-30 disabled:cursor-not-allowed text-cream-50 text-2xl flex items-center justify-center transition-colors"
          >
            ›
          </button>

          <span
            className="absolute left-1/2 -translate-x-1/2 text-cream-50/80 text-xs font-bold uppercase tracking-crowd"
            style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {index + 1} / {photos.length}
          </span>
        </>
      )}

      <img
        src={photo.url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
      />
    </div>
  )
}
