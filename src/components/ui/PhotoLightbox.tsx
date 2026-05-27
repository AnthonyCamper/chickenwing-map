import { useEffect, useState } from 'react'

interface Props {
  photos: { id: string; url: string }[]
  initialIndex: number
  onClose: () => void
}

export default function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
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

  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-[150] bg-night-900/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-cream-50/10 hover:bg-cream-50/20 text-cream-50 text-2xl leading-none flex items-center justify-center transition-colors"
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

          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-cream-50/70 text-xs font-bold uppercase tracking-crowd">
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
