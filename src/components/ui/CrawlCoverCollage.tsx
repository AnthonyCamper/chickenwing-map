/**
 * Cover for a list without its own cover image, built from its spots'
 * photos. The layout follows the number of photos — a fixed 4-tile grid
 * showed one photo and three empty black tiles, which looked broken.
 *   1 photo  → full cover
 *   2 photos → side by side
 *   3 photos → one large on the left, two stacked on the right
 *   4+       → 2×2 grid (a row of 4 from sm up)
 */
export function collageLayout(count: number): { shown: number; grid: string } {
  if (count <= 1) return { shown: Math.max(0, count), grid: 'grid-cols-1' }
  if (count === 2) return { shown: 2, grid: 'grid-cols-2' }
  if (count === 3) return { shown: 3, grid: 'grid-cols-2 grid-rows-2' }
  return { shown: 4, grid: 'grid-cols-2 grid-rows-2 sm:grid-cols-4 sm:grid-rows-1' }
}

export default function CrawlCoverCollage({ photos, className = '' }: { photos: string[]; className?: string }) {
  const { shown, grid } = collageLayout(photos.length)
  if (shown === 0) return null
  const urls = photos.slice(0, shown)

  return (
    <div className={`grid gap-px bg-night-900 ${grid} ${className}`}>
      {urls.map((url, i) => (
        <div
          key={`${i}-${url}`}
          // With 3 photos the first one spans both rows on the left.
          className={`overflow-hidden bg-cream-200 min-h-0 ${shown === 3 && i === 0 ? 'row-span-2' : ''}`}
        >
          <img src={url} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  )
}
