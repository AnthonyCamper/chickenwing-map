import { useEffect, useRef, useState } from 'react'
import { useGallery } from '../../hooks/useGallery'
import PhotoCard from './PhotoCard'
import PhotoModal from './PhotoModal'
import type { GalleryPhoto } from '../../lib/types'

interface Props {
  currentUserId: string
  isAdmin: boolean
}

export default function GalleryView({ currentUserId, isAdmin }: Props) {
  const gallery = useGallery(currentUserId)
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) gallery.loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [gallery.loadMore]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep modal photo data in sync with optimistic like updates
  const syncedPhoto = selectedPhoto
    ? (gallery.photos.find(p => p.photo_id === selectedPhoto.photo_id) ?? selectedPhoto)
    : null

  if (gallery.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
      </div>
    )
  }

  if (gallery.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-charcoal-400 text-sm">{gallery.error}</p>
      </div>
    )
  }

  if (gallery.photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="text-5xl mb-4">📷</div>
        <h3 className="font-display text-lg text-charcoal-700 mb-2">No photos yet</h3>
        <p className="text-sm text-charcoal-400 max-w-xs leading-relaxed">
          Upload photos when you add a review — they'll appear here.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-2xl mx-auto px-4 py-4 pb-safe-8">
        {/* Compact filter/title row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold text-charcoal-700">
            {gallery.photos.length} {gallery.photos.length === 1 ? 'photo' : 'photos'}
          </h2>
        </div>

        {/* Photo grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {gallery.photos.map(photo => (
            <PhotoCard
              key={photo.photo_id}
              photo={photo}
              onOpen={() => setSelectedPhoto(photo)}
              onLike={() => gallery.toggleLike(photo.photo_id)}
            />
          ))}
        </div>

        {/* Infinite scroll sentinel */}
        {gallery.hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {gallery.loadingMore && (
              <div className="w-6 h-6 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
            )}
          </div>
        )}

        {!gallery.hasMore && gallery.photos.length > 0 && (
          <p className="text-center text-xs text-charcoal-300 py-6">All caught up 🍗</p>
        )}
      </div>

      {/* Modal */}
      {syncedPhoto && (
        <PhotoModal
          photo={syncedPhoto}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setSelectedPhoto(null)}
          onLike={() => gallery.toggleLike(syncedPhoto.photo_id)}
          onCommentAdded={() => gallery.refreshPhoto(syncedPhoto.photo_id)}
        />
      )}
    </>
  )
}
