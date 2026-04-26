import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './ui/Modal'
import RatingPicker from './ui/RatingPicker'
import BusinessAutocomplete from './ui/BusinessAutocomplete'
import PhotoUpload from './ui/PhotoUpload'
import type { ReviewFormData } from '../lib/types'

interface Props {
  onClose: () => void
  onSubmit: (data: ReviewFormData) => Promise<{ error: string | null }>
}

const today = new Date().toISOString().split('T')[0]

export default function ReviewFormModal({ onClose, onSubmit }: Props) {
  const [shopName, setShopName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [overallRating, setOverallRating] = useState(0)
  const [wingSize, setWingSize] = useState('')
  const [wingFlavor, setWingFlavor] = useState('')
  const [isTakeout, setIsTakeout] = useState(false)
  const [takeoutContainer, setTakeoutContainer] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [visitedAt, setVisitedAt] = useState(today)
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [showManual, setShowManual] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)

  const geocodeAddress = async () => {
    if (!address.trim()) return
    setGeoLoading(true)
    try {
      const encoded = encodeURIComponent(address.trim())
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`
      )
      const data = await res.json() as Array<{ lat: string; lon: string }>
      if (data[0]) {
        setLat(parseFloat(data[0].lat).toFixed(6))
        setLng(parseFloat(data[0].lon).toFixed(6))
        toast.success('Location found!')
      } else {
        toast.error('Could not find address — enter coordinates manually.')
      }
    } catch {
      toast.error('Geocoding failed — enter coordinates manually.')
    } finally {
      setGeoLoading(false)
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
    if (!shopName.trim() || !address.trim()) {
      toast.error('Please fill in wing spot name and address.')
      return
    }
    if (!lat || !lng) {
      toast.error('Please add a location — select from suggestions or use Find.')
      return
    }
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
    })
    setSubmitting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Review added! 🍗')
    }
  }

  return (
    <Modal title="Add Review" onClose={onClose} size="md">
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
              onChange={setShopName}
              onSelect={handleAutocompleteSelect}
              placeholder="Buffalo Wild Wings, Wingstop…"
            />
            {lat && lng && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <span>✓</span> Location set
              </p>
            )}
          </div>

          {/* Manual fields — collapsed by default if autocomplete filled values */}
          {!showManual && (lat || address) ? (
            <div className="bg-warmgray-50 rounded-2xl px-4 py-3 space-y-0.5">
              <p className="text-sm font-semibold text-charcoal-700">{address}</p>
              <p className="text-xs text-charcoal-400">{lat}, {lng}</p>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="text-xs text-amber-400 hover:text-amber-500 mt-1 transition-colors"
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
                    onChange={e => setAddress(e.target.value)}
                    placeholder="123 Main St, Your City"
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="lat">Latitude</label>
                  <input
                    id="lat"
                    type="number"
                    step="any"
                    className="input"
                    value={lat}
                    onChange={e => setLat(e.target.value)}
                    placeholder="-37.8136"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lng">Longitude</label>
                  <input
                    id="lng"
                    type="number"
                    step="any"
                    className="input"
                    value={lng}
                    onChange={e => setLng(e.target.value)}
                    placeholder="144.9631"
                  />
                </div>
              </div>

              {(address || lat) && (
                <button
                  type="button"
                  onClick={() => setShowManual(false)}
                  className="text-xs text-charcoal-300 hover:text-charcoal-500 transition-colors"
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
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-charcoal-400 hover:text-charcoal-600 transition-colors"
            >
              ← Back
            </button>
            <p className="text-xs text-charcoal-400 font-medium uppercase tracking-widest">
              Step 2 of 2 — Your review
            </p>
          </div>

          <div className="bg-warmgray-50 rounded-2xl px-4 py-3">
            <p className="font-semibold text-charcoal-700 text-sm">{shopName}</p>
            <p className="text-xs text-charcoal-400 mt-0.5">{address}</p>
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
            <label className="label" htmlFor="wing-flavor">Wing Flavor (optional)</label>
            <input
              id="wing-flavor"
              type="text"
              className="input"
              maxLength={60}
              value={wingFlavor}
              onChange={e => setWingFlavor(e.target.value)}
              placeholder="Buffalo Hot, Lemon Pepper, Garlic Parmesan…"
              list="wing-flavor-options"
            />
            <datalist id="wing-flavor-options">
              {[
                "Buffalo Hot", "Buffalo Medium", "Buffalo Mild", "Honey BBQ", "BBQ", "Spicy BBQ",
                "Carolina Gold BBQ", "Nashville Hot", "Garlic Parmesan", "Lemon Pepper", "Teriyaki",
                "Mango Habanero", "Thai Chili", "Sriracha", "Ghost Pepper", "Korean BBQ",
                "Caribbean Jerk", "Bourbon", "Chipotle BBQ", "Old Bay", "Honey Old Bay",
                "Honey Mustard", "Sweet Chili", "Ranch Dry Rub", "Cajun Dry Rub", "Memphis Dry Rub",
                "Salt & Vinegar", "Smoked", "Plain/Naked", "Elote", "Dry Rub", "Spicy Garlic",
                "Honey Garlic", "Peanut Butter Jelly", "Maple Bacon", "Truffle Parmesan",
                "Szechuan", "Hoisin", "Mumbo Sauce", "Alabama White Sauce",
              ].map(f => <option key={f} value={f} />)}
            </datalist>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isTakeout}
                onChange={e => { setIsTakeout(e.target.checked); if (!e.target.checked) setTakeoutContainer('') }}
                className="sr-only"
              />
              <div className={`relative w-9 h-5 rounded-full transition-colors duration-150 ${isTakeout ? 'bg-amber-400' : 'bg-warmgray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-150 ${isTakeout ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-widest text-charcoal-400">Takeout</span>
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
              onClick={onClose}
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
