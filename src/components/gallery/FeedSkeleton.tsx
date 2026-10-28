/**
 * Placeholder review cards shown while the feed loads. Same shape and size as
 * ReviewFeedCard (header, 4:3 photo, text, tags, action bar, comment row), and
 * enough of them to fill a phone screen, so nothing below — the page footer
 * especially — jumps when the real cards arrive.
 */
export default function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">Loading reviews…</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="bg-cream-50 border-2 border-night-900/10 rounded-2xl overflow-hidden shadow-sm animate-pulse motion-reduce:animate-none"
        >
          {/* Header: avatar, name + spot (two 44px rows), rating badge */}
          <div className="flex items-center gap-3 px-4 pt-1">
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-cream-200" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="h-11 flex items-end pb-1"><div className="h-3.5 w-28 rounded bg-cream-200" /></div>
              <div className="h-11 pt-1"><div className="h-3 w-44 max-w-full rounded bg-cream-200" /></div>
            </div>
            <div className="w-12 h-11 rounded-xl bg-cream-200 flex-shrink-0" />
          </div>
          {/* Photo */}
          <div className="aspect-[4/3] bg-cream-200" />
          {/* Text + tags */}
          <div className="px-4 pt-3 pb-1 space-y-2">
            <div className="h-3.5 w-11/12 rounded bg-cream-200" />
            <div className="h-3.5 w-2/3 rounded bg-cream-200" />
          </div>
          <div className="px-4 pt-2 pb-1 flex gap-1.5">
            <div className="h-5 w-24 rounded-full bg-cream-200" />
            <div className="h-5 w-20 rounded-full bg-cream-200" />
          </div>
          {/* Action bar + comment row */}
          <div className="flex items-center gap-1 px-3 py-3 border-t-2 border-night-900/8 mt-2">
            <div className="h-11 w-20 rounded-xl bg-cream-100" />
            <div className="h-11 w-28 rounded-xl bg-cream-100" />
            <div className="h-11 w-20 rounded-xl bg-cream-100 ml-auto" />
          </div>
          <div className="min-h-[44px] px-4 py-3 border-t-2 border-night-900/8">
            <div className="h-4 w-32 rounded bg-cream-100" />
          </div>
        </div>
      ))}
    </div>
  )
}
