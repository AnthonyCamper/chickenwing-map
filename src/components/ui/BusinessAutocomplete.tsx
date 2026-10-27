import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { supabase } from '../../lib/supabase'

export interface Suggestion {
  name: string
  address: string
  lat: string
  lng: string
  /** Stable React key: the WingMap spot id or the OSM place id. */
  key: string
  /** Where the suggestion came from. `wingmap` = a spot already on the site. */
  source: 'wingmap' | 'osm'
  /** Set for `wingmap` suggestions. */
  spotId?: string
}

interface NominatimResult {
  place_id: number
  name: string
  display_name: string
  lat: string
  lon: string
  class?: string
  type?: string
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

interface SpotRow {
  id: string
  name: string
  address: string
  lat: number
  lng: number
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect: (suggestion: Suggestion) => void
  placeholder?: string
  id?: string
  maxLength?: number
}

const MIN_QUERY = 2
const MAX_WINGMAP_RESULTS = 5

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

/**
 * ILIKE pattern for a typed spot name. Punctuation and spaces become
 * wildcards, so "ale marys" finds "Ale Marys" and "mary's" finds "Marys".
 * Returns null when nothing searchable is left.
 */
export function spotNamePattern(query: string): string | null {
  const words = query.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  return words.length ? `%${words.join('%')}%` : null
}

/**
 * Nominatim viewbox ("left,top,right,bottom") around where WingMap's spots
 * are, used to bias map search when the user hasn't shared their location.
 * Uses the 10th–90th percentile so a few far-off spots (or a junk 0,0 one)
 * don't stretch the box over the whole world.
 */
export function viewboxFromSpots(points: Array<{ lat: number; lng: number }>): string | null {
  const valid = points.filter(p =>
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 &&
    !(p.lat === 0 && p.lng === 0)
  )
  if (!valid.length) return null
  const pick = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]
  const lats = valid.map(p => p.lat).sort((a, b) => a - b)
  const lngs = valid.map(p => p.lng).sort((a, b) => a - b)
  const pad = 0.5
  const left = pick(lngs, 0.1) - pad
  const right = pick(lngs, 0.9) + pad
  const top = pick(lats, 0.9) + pad
  const bottom = pick(lats, 0.1) - pad
  const r = (n: number) => n.toFixed(4)
  return `${r(left)},${r(top)},${r(right)},${r(bottom)}`
}

// Fetched once per page load; the spot list is small and the bias only
// needs to be roughly right.
let spotsViewboxPromise: Promise<string | null> | null = null
function getSpotsViewbox(): Promise<string | null> {
  if (!spotsViewboxPromise) {
    spotsViewboxPromise = (async () => {
      const { data, error } = await supabase.from('wing_spots').select('lat,lng').limit(2000)
      if (error || !data) {
        spotsViewboxPromise = null // retry next time
        return null
      }
      return viewboxFromSpots(data as Array<{ lat: number; lng: number }>)
    })()
  }
  return spotsViewboxPromise
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

// Same place already listed from WingMap? (same name, within ~200 m)
function isSameSpot(a: Suggestion, b: Suggestion): boolean {
  if (normalize(a.name) !== normalize(b.name)) return false
  return Math.abs(Number(a.lat) - Number(b.lat)) < 0.002 && Math.abs(Number(a.lng) - Number(b.lng)) < 0.002
}

export default function BusinessAutocomplete({ value, onChange, onSelect, placeholder, id, maxLength }: Props) {
  const [wingmap, setWingmap] = useState<Suggestion[]>([])
  const [osm, setOsm] = useState<Suggestion[]>([])
  const [wingmapLoading, setWingmapLoading] = useState(false)
  const [osmLoading, setOsmLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listboxId = useId()

  // Location is opt-in: asking on mount popped a browser permission prompt
  // the moment the form opened, with no explanation of why.
  const [locating, setLocating] = useState(false)
  const [locationDenied, setLocationDenied] = useState(false)
  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationDenied(true); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false) },
      () => { setLocationDenied(true); setLocating(false) },
      { timeout: 8000 }
    )
  }

  // Warm the spot-area bias so the first map search can use it.
  useEffect(() => { void getSpotsViewbox() }, [])

  const searchWingmap = useCallback(async (query: string, signal: AbortSignal): Promise<Suggestion[]> => {
    const pattern = spotNamePattern(query)
    if (!pattern) return []
    const { data, error } = await supabase
      .from('wing_spots')
      .select('id,name,address,lat,lng')
      .ilike('name', pattern)
      .order('name')
      .limit(MAX_WINGMAP_RESULTS)
      .abortSignal(signal)
    if (error || !data) return []
    return (data as SpotRow[]).map(s => ({
      name: s.name,
      address: s.address,
      // Keep the stored values untouched: the review is matched to this
      // spot by exact name + address.
      lat: String(s.lat),
      lng: String(s.lng),
      key: `wm-${s.id}`,
      source: 'wingmap' as const,
      spotId: s.id,
    }))
  }, [])

  const searchOsm = useCallback(async (query: string, signal: AbortSignal): Promise<Suggestion[]> => {
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
    } else {
      // No location shared: bias toward where WingMap's spots are.
      const box = await getSpotsViewbox()
      if (box) {
        params.set('viewbox', box)
        params.set('bounded', '0')
      }
    }

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en' },
      signal,
    })
    const data = (await res.json()) as NominatimResult[]

    return data
      // Towns, regions and admin areas aren't wing spots.
      .filter(r => r.class !== 'boundary' && !(r.class === 'place' && r.type !== 'house'))
      .map(r => ({
        name: r.namedetails?.name ?? r.name ?? r.display_name.split(',')[0].trim(),
        address: buildAddress(r),
        lat: r.lat,
        lng: r.lon,
        key: `osm-${r.place_id}`,
        source: 'osm' as const,
      }))
      .filter(s => s.name)
  }, [userLocation])

  const search = useCallback(async (query: string) => {
    // Cancel any in-flight request before starting a new one.
    abortRef.current?.abort()

    if (query.trim().length < MIN_QUERY) {
      setWingmap([])
      setOsm([])
      setWingmapLoading(false)
      setOsmLoading(false)
      setOpen(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    const isCurrent = () => abortRef.current === controller && !controller.signal.aborted

    setOpen(true)
    setActiveIndex(-1)
    setWingmapLoading(true)
    setOsmLoading(true)

    // WingMap's own spots usually answer first — show them as soon as they land.
    const wingmapTask = searchWingmap(query, controller.signal)
      .catch(() => [] as Suggestion[])
      .then(results => {
        if (!isCurrent()) return
        setWingmap(results)
        setWingmapLoading(false)
      })

    const osmTask = searchOsm(query, controller.signal)
      .catch(() => [] as Suggestion[])
      .then(results => {
        if (!isCurrent()) return
        setOsm(results)
        setOsmLoading(false)
      })

    await Promise.all([wingmapTask, osmTask])
  }, [searchWingmap, searchOsm])

  // Cancel any pending fetch / debounce on unmount.
  useEffect(() => () => {
    abortRef.current?.abort()
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < MIN_QUERY) {
      void search(val)
      return
    }
    debounceRef.current = setTimeout(() => { void search(val) }, 300)
  }

  const osmShown = osm.filter(o => !wingmap.some(w => isSameSpot(w, o)))
  const suggestions = [...wingmap, ...osmShown]
  const loading = wingmapLoading || osmLoading

  const handleSelect = (suggestion: Suggestion) => {
    abortRef.current?.abort()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    onChange(suggestion.name)
    onSelect(suggestion)
    setOpen(false)
    setWingmap([])
    setOsm([])
    setWingmapLoading(false)
    setOsmLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
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
        (!dropdownRef.current || !dropdownRef.current.contains(e.target as Node))
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const showDropdown = open && value.trim().length >= MIN_QUERY

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
          onFocus={() => (suggestions.length > 0 || loading) && setOpen(true)}
          placeholder={placeholder ?? 'Search for a wing spot…'}
          maxLength={maxLength}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-cream-200 border-t-sauce-400 rounded-full animate-spin" aria-hidden />
        )}
        {userLocation && !loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal-400" title="Searching near your location">
            📍
          </div>
        )}
      </div>

      {!userLocation && !locationDenied && typeof navigator !== 'undefined' && 'geolocation' in navigator && (
        <button
          type="button"
          onClick={requestLocation}
          disabled={locating}
          className="mt-1 min-h-[44px] text-xs font-bold text-sauce-600 hover:text-sauce-700 transition-colors"
        >
          {locating ? 'Finding your location…' : '📍 Show places near me'}
        </button>
      )}
      {locationDenied && (
        <p className="mt-1 text-xs text-charcoal-500">Location is off, so results aren't sorted by distance.</p>
      )}

      {showDropdown && (
        <div
          ref={dropdownRef}
          id={listboxId}
          className="absolute left-0 right-0 top-full mt-1 bg-cream-50 rounded-2xl shadow-elevated border-2 border-night-900 overflow-hidden z-50 max-h-72 overflow-y-auto overscroll-contain"
          role="listbox"
          aria-label="Wing spot suggestions"
          aria-busy={loading || undefined}
        >
          {suggestions.map((s, i) => (
            <div key={s.key} role="presentation">
              {s.source === 'osm' && i === wingmap.length && wingmap.length > 0 && (
                <p className="px-4 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-crowd text-charcoal-500 border-t border-night-900/10">
                  Other places on the map
                </p>
              )}
              <button
                id={`${listboxId}-${i}`}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={e => { e.preventDefault(); handleSelect(s) }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-night-900/10 min-h-[56px] ${
                  i === activeIndex ? 'bg-cream-100' : 'hover:bg-cream-100/60'
                }`}
              >
                <span className="text-base mt-0.5 flex-shrink-0" aria-hidden>{s.source === 'wingmap' ? '🍗' : '📍'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-night-800 truncate">{s.name}</p>
                  <p className="text-xs text-charcoal-500 truncate mt-0.5">
                    {s.source === 'wingmap' && (
                      <span className="font-bold text-sauce-600">Already on WingKingTony · </span>
                    )}
                    {s.address || 'No address listed'}
                  </p>
                </div>
              </button>
            </div>
          ))}

          {loading && (
            <p className="px-4 py-3 text-sm text-charcoal-500" role="status">
              {suggestions.length ? 'Searching for more places…' : 'Searching…'}
            </p>
          )}

          {!loading && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-charcoal-600" role="status">
              No matches. Check the spelling or add the address below.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
