// Placeholders for the Spots and Map tabs while their code or data loads.
// On slow 3G that wait was 4–7 s of a lone spinner, then the page jumped
// into place. These reserve roughly the real layout instead, so content
// arrives where the placeholders already are.
//
// Kept in their own tiny module (no Leaflet, no data hooks) so Home can use
// them as the Suspense fallback without pulling in the lazy views.

function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-md bg-cream-200 ${className}`} />
}

/** Same outer box as ListView: heading, search, sort row, then cards. */
export function ListViewSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-5 pb-safe-fab animate-pulse" role="status">
      <span className="sr-only">Loading spots…</span>

      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Bar className="h-3 w-28 mb-2" />
          <Bar className="h-8 w-3/4" />
        </div>
        <Bar className="h-8 w-24 flex-shrink-0 rounded-full" />
      </div>

      {/* Search field (same height as .input) */}
      <div aria-hidden="true" className="mb-4 h-[52px] rounded-lg border-2 border-cream-200 bg-cream-50" />

      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <Bar className="h-11 w-56 rounded-full" />
        <Bar className="h-11 w-40 rounded-full" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} aria-hidden="true" className="card px-4 py-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <Bar className="h-5 w-2/3" />
              <Bar className="h-3 w-5/6 mt-2" />
              <div className="flex items-center gap-3 mt-3">
                <Bar className="h-7 w-16" />
                <Bar className="h-3 w-14" />
              </div>
            </div>
            <Bar className="w-16 h-16 flex-shrink-0 rounded-lg" />
          </div>
        ))}
      </div>

      <p className="mt-6 text-center font-display uppercase tracking-crowd text-sm text-night-700">
        Loading spots…
      </p>
    </div>
  )
}

/** Map-coloured area filling the screen below the header, with a status pill. */
export function MapViewSkeleton() {
  return (
    <div
      className="relative w-full bg-[#f2efe9]"
      // Close to MapView's own measured height; MapView corrects it on mount.
      style={{ height: 'calc(100dvh - 6.5rem)' }}
      role="status"
    >
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-full bg-cream-50/95 border-2 border-night-900 shadow-sticker-sm px-3 py-1.5">
          <span aria-hidden="true" className="w-3.5 h-3.5 rounded-full border-2 border-cream-200 border-t-sauce-400 animate-spin" />
          <span className="text-[11px] font-extrabold uppercase tracking-crowd text-night-900 whitespace-nowrap">Loading the map…</span>
        </div>
      </div>
    </div>
  )
}
