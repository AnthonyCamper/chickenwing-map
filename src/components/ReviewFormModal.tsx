import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './ui/Modal'
import RatingPicker from './ui/RatingPicker'
import BusinessAutocomplete from './ui/BusinessAutocomplete'
import PhotoUpload from './ui/PhotoUpload'
import WingFlavorPicker from './ui/WingFlavorPicker'
import type { ReviewFormData } from '../lib/types'

interface PrefillSpot {
  shop_name: string
  address: string
  lat: string | number
  lng: string | number
}

interface EventContext {
  event_id: string
  event_stop_id: string
  event_name: string
}

interface Props {
  onClose: () => void
  onSubmit: (data: ReviewFormData) => Promise<{ error: string | null }>
  prefill?: PrefillSpot
  eventContext?: EventContext
}

const today = new Date().toISOString().split('T')[0]

export default function ReviewFormModal({ onClose, onSubmit, prefill, eventContext }: Props) {
  const [shopName, setShopName] = useState(prefill?.shop_name ?? '')
  const [address, setAddress] = useState(prefill?.address ?? '')
  const [lat, setLat] = useState(prefill ? String(prefill.lat) : '')
  const [lng, setLng] = useState(prefill ? String(prefill.lng) : '')
  const [overallRating, setOverallRating] = useState(0)
  const [wingSize, setWingSize] = useState('')
  const [wingFlavor, setWingFlavor] = useState('')
  const [isTakeout, setIsTakeout] = useState(false)
  const [takeoutContainer, setTakeoutContainer] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [visitedAt, setVisitedAt] = useState(today)
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  // When pre-filled (e.g. checking in at an event stop) we skip step 1.
  const [step, setStep] = useState<1 | 2>(prefill ? 2 : 1)
  const [showManual, setShowManual] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  // Per-field errors (cleared when the user edits the field).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const clearError = (key: string) =>
    setFieldErrors(prev => { if (!prev[key]) return prev; const { [key]: _, ...rest } = prev; return rest })

  // Track whether the user has put real input in — used for the discard guard.
  const isDirty =
    overallRating > 0
    || !!wingFlavor
    || !!wingSize
    || isTakeout
    || !!reviewText.trim()
    || photos.length > 0
    || (!prefill && (!!shopName.trim() || !!address.trim()))

  const handleCloseAttempt = () => {
    if (isDirty && !submitting) {
      const ok = window.confirm('Discard your review? Anything you entered will be lost.')
      if (!ok) return
    }
    onClose()
  }

  const geoAbortRef = useRef<AbortController | null>(null)
  useEffect(() => () => geoAbortRef.current?.abort(), [])

  const geocodeAddress = async () => {
    if (!address.trim()) return
    geoAbortRef.current?.abort()
    const controller = new AbortController()
    geoAbortRef.current = controller
    setGeoLoading(true)
    try {
      const encoded = encodeURIComponent(address.trim())
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
        { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json() as Array<{ lat: string; lon: string }>
      if (data[0]) {
        setLat(parseFloat(data[0].lat).toFixed(6))
        setLng(parseFloat(data[0].lon).toFixed(6))
        toast.success('Location found!')
      } else {
        toast.error('Could not find address — enter coordinates manually.')
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return
      toast.error('Geocoding failed — enter coordinates manually.')
    } finally {
      if (geoAbortRef.current === controller) setGeoLoading(false)
    }
  }

  const handleAutocompleteSelect = (suggestion: { name: string; address: string; lat: string; lng: string }) => {
    setShopName(suggestion.name)
    setAddress(suggestion.address)
    setLat(parseFloat(suggestion.lat).toFixed(6))
    setLng(parseFloat(suggestion.lng).toFixed(6))
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!shopName.trim()) errs.shopName = 'Add a name for the wing spot.'
    if (!address.trim()) errs.address = 'Add an address.'

    const latNum = lat ? Number(lat) : NaN
    const lngNum = lng ? Number(lng) : NaN
    if (!lat || !lng || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      errs.location = 'Add a location — pick a suggestion or tap Find.'
    } else if (latNum < -90 || latNum > 90) {
      errs.lat = 'Latitude must be between -90 and 90.'
    } else if (lngNum < -180 || lngNum > 180) {
      errs.lng = 'Longitude must be between -180 and 180.'
    }

    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (overallRating === 0) {
      toast.error('Please set a rating.')
      return
    }
    setSubmitting(true)
    const result = await onSubmit({
      shop_name: shopName,
      address,
      lat,
      lng,
      overall_rating: overallRating,
      wing_size: wingSize || undefined,
      wing_flavor: wingFlavor || undefined,
      is_takeout: isTakeout,
      takeout_container: isTakeout ? takeoutContainer || undefined : undefined,
      review_text: reviewText || undefined,
      visited_at: visitedAt,
      photos,
      event_id: eventContext?.event_id,
      event_stop_id: eventContext?.event_stop_id,
    })
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Review added! 🍗')
    }
  }

  return (
    <Modal title={eventContext ? `Review for ${eventContext.event_name}` : 'Add Review'} onClose={handleCloseAttempt} size="md">
      {step === 1 ? (
        <form onSubmit={handleNext} className="px-6 py-5 space-y-4">
          <p className="text-xs text-charcoal-400 font-medium uppercase tracking-widest">
            Step 1 of 2 — Wing spot details
          </p>

          {/* Autocomplete search */}
          <div>
            <label className="label" htmlFor="shop-search">Search Wing Spot</label>
            <BusinessAutocomplete
              id="shop-search"
              value={shopName}
              onChange={v => { setShopName(v); clearError('shopName') }}
              onSelect={s => { handleAutocompleteSelect(s); setFieldErrors({}) }}
              placeholder="Buffalo Wild Wings, Wingstop…"
            />
            {fieldErrors.shopName && (
              <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.shopName}</p>
            )}
            {lat && lng && !fieldErrors.location && (
              <p className="text-xs text-sauce-600 mt-1 flex items-center gap-1">
                <span>✓</span> Location set
              </p>
            )}
            {fieldErrors.location && (
              <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.location}</p>
            )}
          </div>

          {/* Manual fields — collapsed by default if autocomplete filled values */}
          {!showManual && (lat || address) ? (
            <div className="bg-cream-100 rounded-2xl px-4 py-3 space-y-0.5 border border-night-900/10">
              <p className="text-sm font-bold text-night-800">{address}</p>
              <p className="text-xs text-charcoal-500">{lat}, {lng}</p>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="text-xs font-extrabold uppercase tracking-crowd text-sauce-500 hover:text-sauce-600 mt-1 transition-colors"
              >
                Edit manually
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="address">Address</label>
                <div className="flex gap-2">
                  <input
                    id="address"
                    type="text"
                    className="input flex-1"
                    value={address}
                    onChange={e => { setAddress(e.target.value); clearError('address') }}
                    placeholder="123 Main St, Your City"
                    aria-invalid={!!fieldErrors.address || undefined}
                  />
                  <button
                    type="button"
                    onClick={geocodeAddress}
                    disabled={geoLoading || !address.trim()}
                    className="btn-secondary px-3 py-3 text-xs whitespace-nowrap flex-shrink-0"
                  >
                    {geoLoading ? '…' : 'Find'}
                  </button>
                </div>
                {fieldErrors.address && (
                  <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.address}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="lat">Latitude</label>
                  <input
                    id="lat"
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    className="input"
                    value={lat}
                    onChange={e => { setLat(e.target.value); clearError('lat'); clearError('location') }}
                    placeholder="-37.8136"
                    aria-invalid={!!fieldErrors.lat || undefined}
                  />
                  {fieldErrors.lat && (
                    <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.lat}</p>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="lng">Longitude</label>
                  <input
                    id="lng"
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    className="input"
                    value={lng}
                    onChange={e => { setLng(e.target.value); clearError('lng'); clearError('location') }}
                    placeholder="144.9631"
                    aria-invalid={!!fieldErrors.lng || undefined}
                  />
                  {fieldErrors.lng && (
                    <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.lng}</p>
                  )}
                </div>
              </div>

              {(address || lat) && (
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="text-xs text-charcoal-400 hover:text-charcoal-500 transition-colors"
                >
                  Collapse
                </button>
              )}
            </div>
          )}

          <div className="pt-1 pb-2">
            <button type="submit" className="btn-primary w-full">
              Next →
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-2">
            {!prefill && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-charcoal-400 hover:text-charcoal-600 transition-colors"
              >
                ← Back
              </button>
            )}
            <p className="text-xs text-charcoal-400 font-medium uppercase tracking-widest">
              {prefill ? 'Your review' : 'Step 2 of 2 — Your review'}
            </p>
          </div>

          {eventContext && (
            <div className="rounded-2xl px-4 py-3 bg-sauce-50 border border-sauce-200">
              <p className="text-xs font-extrabold uppercase tracking-crowd text-sauce-600 mb-0.5">
                🍗 Event review
              </p>
              <p className="text-sm font-bold text-night-800">{eventContext.event_name}</p>
              <p className="text-xs text-charcoal-500">This review will be tagged with the event.</p>
            </div>
          )}

          <div className="bg-cream-100 rounded-2xl px-4 py-3 border border-night-900/10">
            <p className="font-bold text-night-800 text-sm">{shopName}</p>
            <p className="text-xs text-charcoal-500 mt-0.5">{address}</p>
          </div>

          <RatingPicker
            value={overallRating}
            onChange={setOverallRating}
            accent="amber"
            icon="🍗"
            label="Wing Rating"
          />


          <div>
            <label className="label" htmlFor="wing-size">Wing Size (optional)</label>
            <select
              id="wing-size"
              className="input"
              value={wingSize}
              onChange={e => setWingSize(e.target.value)}
            >
              <option value="">Select size…</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="jumbo">Jumbo</option>
            </select>
          </div>

          <div>
            <label className="label">Wing Flavor (optional)</label>
            <WingFlavorPicker value={wingFlavor} onChange={setWingFlavor} />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px]">
              <input
                type="checkbox"
                checked={isTakeout}
                onChange={e => { setIsTakeout(e.target.checked); if (!e.target.checked) setTakeoutContainer('') }}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors duration-150 ${isTakeout ? 'bg-sauce-400' : 'bg-night-900/20'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-150 ${isTakeout ? 'translate-x-[22px]' : 'translate-x-0'}`} />
              </div>
              <span className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-600">Takeout</span>
            </label>
          </div>

          {isTakeout && (
            <div>
              <label className="label" htmlFor="takeout-container">Container Type (optional)</label>
              <select
                id="takeout-container"
                className="input"
                value={takeoutContainer}
                onChange={e => setTakeoutContainer(e.target.value)}
              >
                <option value="">Select container…</option>
                <option value="styrofoam">Styrofoam</option>
                <option value="cardboard">Cardboard</option>
                <option value="plastic">Plastic</option>
                <option value="aluminum">Aluminum</option>
                <option value="bag_only">Bag only</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="review-text">Review (optional)</label>
            <textarea
              id="review-text"
              className="input resize-none"
              rows={4}
              maxLength={500}
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              placeholder="Tell us about the wings..."
            />
          </div>

          <div>
            <label className="label" htmlFor="visited">Date Visited</label>
            <input
              id="visited"
              type="date"
              className="input"
              value={visitedAt}
              onChange={e => setVisitedAt(e.target.value)}
              max={today}
              required
            />
          </div>

          <div>
            <label className="label">Photos (optional)</label>
            <PhotoUpload files={photos} onChange={setPhotos} />
          </div>

          <div className="flex gap-3 pb-2">
            <button
              type="button"
              onClick={handleCloseAttempt}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || overallRating === 0}
              className="btn-primary flex-1"
            >
              {submitting ? 'Saving…' : 'Add Review'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
