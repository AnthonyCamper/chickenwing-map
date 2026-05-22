import { useState, useRef, useCallback, useEffect } from 'react'

const KLIPPY_API_KEY = import.meta.env.VITE_KLIPPY_API_KEY as string | undefined
const KLIPPY_BASE = 'https://api.klipy.co/api/v1'

interface KlippyAsset {
  url: string
  width: number
  height: number
}

interface KlippyGif {
  id: number | string
  slug?: string
  title?: string
  file: {
    sm?: { gif?: KlippyAsset; webp?: KlippyAsset }
    md?: { gif?: KlippyAsset; webp?: KlippyAsset }
    hd?: { gif?: KlippyAsset; webp?: KlippyAsset }
  }
}

interface Props {
  onSelect: (url: string) => void
  onClose: () => void
}

export default function GifPicker({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<KlippyGif[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchTrending = useCallback(async () => {
    if (!KLIPPY_API_KEY) {
      setError('GIF search isn\'t configured')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${KLIPPY_BASE}/${KLIPPY_API_KEY}/gifs/trending?per_page=24`
      )
      const data = await res.json()
      setGifs(data?.data?.data ?? [])
    } catch {
      setError('Couldn\'t load GIFs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
    fetchTrending()
  }, [fetchTrending])

  const searchGifs = useCallback(async (q: string) => {
    if (!q.trim()) {
      fetchTrending()
      return
    }
    if (!KLIPPY_API_KEY) {
      setError('GIF search isn\'t configured')
      return
    }
    setLoading(true)
    setHasSearched(true)
    setError(null)
    try {
      const res = await fetch(
        `${KLIPPY_BASE}/${KLIPPY_API_KEY}/gifs/search?q=${encodeURIComponent(q)}&per_page=24`
      )
      const data = await res.json()
      setGifs(data?.data?.data ?? [])
    } catch {
      setError('Couldn\'t load GIFs')
      setGifs([])
    } finally {
      setLoading(false)
    }
  }, [fetchTrending])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchGifs(value), 350)
  }

  // Preview: small webp for fast grid load (fallback to small gif)
  const getPreviewUrl = (gif: KlippyGif) =>
    gif.file.sm?.webp?.url ?? gif.file.sm?.gif?.url ?? gif.file.md?.gif?.url ?? ''

  // Send: medium gif for nice quality in the comment thread
  const getSendUrl = (gif: KlippyGif) =>
    gif.file.md?.gif?.url ?? gif.file.sm?.gif?.url ?? gif.file.hd?.gif?.url ?? ''

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-warmgray-200 shadow-lg overflow-hidden max-h-[320px] sm:max-h-[360px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-warmgray-100">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search GIFs…"
            className="w-full rounded-lg border border-warmgray-300 bg-warmgray-50 px-3 py-1.5 text-sm text-charcoal-700 placeholder:text-charcoal-300 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
          />
        </div>
        <button
          onClick={onClose}
          className="text-xs text-charcoal-400 hover:text-charcoal-600 px-2 py-1 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <p className="text-center text-xs text-charcoal-400 py-8">{error}</p>
        )}

        {!loading && !error && gifs.length === 0 && hasSearched && (
          <p className="text-center text-xs text-charcoal-300 py-8">
            No GIFs found — try a different search
          </p>
        )}

        {!loading && !error && gifs.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map(gif => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onSelect(getSendUrl(gif))}
                className="relative rounded-lg overflow-hidden bg-warmgray-100 hover:ring-2 hover:ring-amber-300 transition-all aspect-video group"
              >
                <img
                  src={getPreviewUrl(gif)}
                  alt={gif.title || 'GIF'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="flex-shrink-0 px-3 py-1 border-t border-warmgray-100 bg-warmgray-50">
        <p className="text-[10px] text-charcoal-300 text-right">Powered by Klipy</p>
      </div>
    </div>
  )
}
