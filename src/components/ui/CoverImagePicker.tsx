import { useRef } from 'react'
import toast from 'react-hot-toast'

interface Props {
  preview: string | null
  onChange: (file: File) => void
  onClear: () => void
  maxBytes?: number
}

/**
 * Shared cover-image picker used by both AdminEventsTab (event covers)
 * and CrawlEditor (crawl covers). Stateless re: upload — parent handles
 * the actual upload after onChange fires with the picked File.
 */
export default function CoverImagePicker({
  // Default suits uncompressed upload paths (event covers). Callers whose
  // pipeline compresses (crawl covers) pass a higher cap.
  preview, onChange, onClear, maxBytes = 5 * 1024 * 1024,
}: Props) {
  const maxMb = Math.round(maxBytes / 1024 / 1024)
  const fileRef = useRef<HTMLInputElement>(null)

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > maxBytes) {
      toast.error(`That image is too big (max ${maxMb} MB)`)
      e.target.value = ''
      return
    }
    onChange(f)
    e.target.value = ''
  }

  return (
    <div>
      <label className="label">Cover image</label>

      {preview ? (
        <div className="relative rounded-2xl overflow-hidden bg-warmgray-100 border-2 border-night-900">
          <a href={preview} target="_blank" rel="noopener noreferrer" className="block">
            <img src={preview} alt="Cover preview" className="w-full max-h-72 object-contain bg-night-900" />
          </a>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t-2 border-night-900 bg-cream-50">
            <span className="text-xs text-charcoal-500">Click image to view full size</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="min-h-[44px] px-2 -my-2 text-xs font-extrabold uppercase tracking-crowd text-sauce-500 hover:text-sauce-600 transition-colors"
              >
                Change
              </button>
              <span className="text-warmgray-300">|</span>
              <button
                type="button"
                onClick={onClear}
                className="min-h-[44px] px-2 -my-2 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:text-sauce-600 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full h-32 rounded-2xl border-2 border-dashed border-warmgray-300 hover:border-sauce-400 hover:bg-cream-100 transition-colors flex flex-col items-center justify-center gap-2 text-charcoal-400 hover:text-sauce-500"
        >
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="text-sm font-medium">Upload cover image</span>
          <span className="text-xs">JPG, PNG, WebP · max {maxMb} MB</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={pick}
      />
    </div>
  )
}
