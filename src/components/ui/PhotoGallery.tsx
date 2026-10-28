import { useEffect, useRef, useState } from 'react'
import type { ReviewPhoto } from '../../lib/types'
import { useBackClosesOverlay } from '../../hooks/useBackClosesOverlay'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface Props {
  photos: ReviewPhoto[]
  className?: string
  /** When provided, clicking a photo calls this instead of opening the lightbox */
  onPhotoOpen?: (photoId: string) => void
  /** Describes the photos for screen readers, e.g. "Photo of wings at Duff's" */
  alt?: string
}

export default function PhotoGallery({ photos, className = '', onPhotoOpen, alt = 'Wing photo' }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  const handleClick = (photo: ReviewPhoto, index: number) => {
    if (onPhotoOpen) {
      onPhotoOpen(photo.id)
    } else {
      setLightboxIndex(index)
    }
  }

  return (
    <>
      <div className={`grid grid-cols-3 gap-1.5 ${className}`}>
        {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => handleClick(photo, i)}
              aria-label={`Open photo ${i + 1} of ${photos.length} full size`}
              className="relative aspect-square rounded-xl overflow-hidden bg-warmgray-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <img
                src={photo.url}
                alt={alt}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          alt={alt}
        />
      )}
    </>
  )
}

export { Lightbox }

interface LightboxProps {
  photos: ReviewPhoto[]
  initialIndex: number
  onClose: () => void
  /** Describes the photo for screen readers */
  alt?: string
}

const SWIPE_THRESHOLD_PX = 50

function Lightbox({ photos, initialIndex, onClose, alt = 'Wing photo' }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const dialogRef = useFocusTrap<HTMLDivElement>()
  // Browser Back closes the viewer (and only the viewer, when it's open
  // on top of PhotoModal) instead of leaving the page
  useBackClosesOverlay(onClose)

  const prev = () => setIndex(i => (i - 1 + photos.length) % photos.length)
  const next = () => setIndex(i => (i + 1) % photos.length)

  // iOS-safe scroll lock with position preservation (same as PhotoLightbox)
  useEffect(() => {
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
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    // Horizontal swipe navigates (must be more horizontal than vertical)
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) prev()
      else next()
    }
    // Downward swipe closes
    else if (dy > SWIPE_THRESHOLD_PX * 1.5 && Math.abs(dy) > Math.abs(dx)) {
      onClose()
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={photos.length > 1 ? `Photo viewer, photo ${index + 1} of ${photos.length}` : 'Photo viewer'}
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image */}
      <img
        src={photos[index].url}
        alt={photos.length > 1 ? `${alt} (${index + 1} of ${photos.length})` : alt}
        className="max-w-full max-h-full object-contain px-14"
        onClick={e => e.stopPropagation()}
      />

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xl transition-colors"
        aria-label="Close photo"
      >
        ×
      </button>

      {/* Counter */}
      {photos.length > 1 && (
        <div aria-hidden="true" className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
          {index + 1} / {photos.length}
        </div>
      )}

      {/* Prev / Next */}
      {photos.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-night-900/70 hover:bg-night-900/90 ring-1 ring-white/40 shadow-lg text-white flex items-center justify-center text-2xl transition-colors"
            aria-label="Previous photo"
          >
            ‹
          </button>
          <button
            onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-night-900/70 hover:bg-night-900/90 ring-1 ring-white/40 shadow-lg text-white flex items-center justify-center text-2xl transition-colors"
            aria-label="Next photo"
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
