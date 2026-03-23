import { useState, useEffect, useRef, useCallback } from 'react'

interface Suggestion {
  name: string
  address: string
  lat: string
  lng: string
  placeId: number
}

interface NominatimResult {
  place_id: number
  name: string
  display_name: string
  lat: string
  lon: string
  namedetails?: { name?: string }
  address?: {
    house_number?: string
    road?: string
    suburb?: string
    neighbourhood?: string
    city?: string
    town?: string
    village?: string
    state?: string
    postcode?: string
    country?: string
  }
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: Suggestion) => void
  placeholder?: string
  id?: string
}

function buildAddress(result: NominatimResult): string {
  const a = result.address
  if (!a) {
    // Fall back to display_name minus the business name and country
    const parts = result.display_name.split(', ')
    const nameIdx = parts.findIndex(p => p === result.name)
    const filtered = nameIdx >= 0 ? parts.slice(nameIdx + 1) : parts
    return filtered.slice(0, -1).join(', ') // drop country
  }
  const streetNum = a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road
  const locality = a.suburb ?? a.neighbourhood ?? a.village ?? a.town ?? a.city
  const parts = [streetNum, locality, a.city !== locality ? a.city : undefined, a.state, a.postcode].filter(Boolean)
  return parts.join(', ')
}

export default function BusinessAutocomplete({ value, onChange, onSelect, placeholder, id }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Request user location on mount (silently)
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* silently ignore denial */ },
      { timeout: 5000 }
    )
  }, [])

  const search = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '6',
        addressdetails: '1',
        namedetails: '1',
        'accept-language': 'en',
      })

      if (userLocation) {
        // Bias results toward user's location with a ~20km viewbox
        const d = 0.2
        params.set('viewbox', `${userLocation.lng - d},${userLocation.lat + d},${userLocation.lng + d},${userLocation.lat - d}`)
        params.set('bounded', '0')
      }

      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'en' },
      })
      const data = (await res.json()) as NominatimResult[]

      const mapped: Suggestion[] = data.map(r => ({
        name: r.namedetails?.name ?? r.name ?? r.display_name.split(',')[0].trim(),
        address: buildAddress(r),
        lat: r.lat,
        lng: r.lon,
        placeId: r.place_id,
      })).filter(s => s.name)

      setSuggestions(mapped)
      setOpen(mapped.length > 0)
      setActiveIndex(-1)
    } catch {
      setSuggestions([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [userLocation])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.name)
    onSelect(suggestion)
    setOpen(false)
    setSuggestions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="input pr-8"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? 'Search for a wing spot…'}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-amber-300 border-t-amber-400 rounded-full animate-spin" />
        )}
        {userLocation && !loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal-300" title="Searching near your location">
            📍
          </div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-elevated border border-warmgray-200 overflow-hidden z-50 max-h-72 overflow-y-auto"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.placeId}
              type="button"
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-warmgray-50 last:border-0 ${
                i === activeIndex ? 'bg-warmgray-50' : 'hover:bg-warmgray-50/60'
              }`}
            >
              <span className="text-base mt-0.5 flex-shrink-0">🍗</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-charcoal-700 truncate">{s.name}</p>
                <p className="text-xs text-charcoal-400 truncate mt-0.5">{s.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
