import type { ReviewPhoto } from '../../lib/types'

/**
 * Groups a spot's flattened photo list into one array per review.
 * Review order follows first appearance in the input (the input is
 * newest-review-first); photos within a review sort by display_order.
 */
export function groupPhotosByReview(photos: ReviewPhoto[]): ReviewPhoto[][] {
  const groups = new Map<string, ReviewPhoto[]>()
  for (const p of photos) {
    const list = groups.get(p.review_id)
    if (list) list.push(p)
    else groups.set(p.review_id, [p])
  }
  return Array.from(groups.values(), list =>
    [...list].sort((a, b) => a.display_order - b.display_order)
  )
}

interface Props {
  /** One review's photos, any order (sorted here for safety). */
  photos: ReviewPhoto[]
  onOpen: () => void
}

/**
 * One photo-strip item representing a single review: a plain thumbnail for
 * one photo, a fanned stack with a ×N badge for several. Static transforms
 * only; rotation is dropped under reduced motion.
 */
export default function ReviewPhotoFan({ photos, onOpen }: Props) {
  if (photos.length === 0) return null
  const ordered = [...photos].sort((a, b) => a.display_order - b.display_order)
  const front = ordered[0]
  const behind = ordered.slice(1, 3)

  return (
    <button
      onClick={onOpen}
      aria-label={ordered.length > 1 ? `View ${ordered.length} photos` : 'View photo'}
      className="relative flex-shrink-0 w-20 h-20 rounded-xl focus:outline-none focus:ring-2 focus:ring-sauce-300"
    >
      {behind.map((p, i) => (
        <img
          key={p.id}
          src={p.url}
          alt=""
          aria-hidden
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover rounded-xl border-2 border-night-900 bg-cream-200 ${
            i === 0
              ? 'rotate-[6deg] translate-x-[4px] motion-reduce:rotate-0'
              : '-rotate-[6deg] -translate-x-[4px] motion-reduce:rotate-0'
          }`}
        />
      ))}
      <img
        src={front.url}
        alt=""
        loading="lazy"
        className="relative w-full h-full object-cover rounded-xl border-2 border-night-900 bg-cream-200 hover:border-sauce-400 transition-colors"
      />
      {ordered.length > 1 && (
        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-night-900 text-cream-50 text-[10px] font-extrabold leading-none border border-cream-50">
          ×{ordered.length}
        </span>
      )}
    </button>
  )
}
