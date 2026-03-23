import { useEffect, useState } from 'react'
import type { ReviewPhoto } from '../../lib/types'

interface Props {
  photos: ReviewPhoto[]
  className?: string
  /** When provided, clicking a photo calls this instead of opening the lightbox */
  onPhotoOpen?: (photoId: string) => void
  /** Map of photo_id → comment count; shows badge on thumbnails with comments */
  commentCounts?: Record<string, number>
}

export default function PhotoGallery({ photos, className = '', onPhotoOpen, commentCounts }: Props) {
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
        {photos.map((photo, i) => {
          const count = commentCounts?.[photo.id] ?? 0
          return (
            <button
              key={photo.id}
              onClick={() => handleClick(photo, i)}
              className="relative aspect-square rounded-xl overflow-hidden bg-warmgray-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <img
                src={photo.url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {count > 0 && (
                <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 bg-black/40 backdrop-blur-sm rounded-full px-1.5 py-0.5">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="text-white text-[10px] font-medium">{count}</span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
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
}

function Lightbox({ photos, initialIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex)

  const prev = () => setIndex(i => (i - 1 + photos.length) % photos.length)
  const next = () => setIndex(i => (i + 1) % photos.length)

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

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Image */}
      <img
        src={photos[index].url}
        alt=""
        className="max-w-full max-h-full object-contain px-14"
        onClick={e => e.stopPropagation()}
      />

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xl transition-colors"
        aria-label="Close"
      >
        ×
      </button>

      {/* Counter */}
      {photos.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
          {index + 1} / {photos.length}
        </div>
      )}

      {/* Prev / Next */}
      {photos.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg transition-colors"
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-lg transition-colors"
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}
    </div>
  )
}
