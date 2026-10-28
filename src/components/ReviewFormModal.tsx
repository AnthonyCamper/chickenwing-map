import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Modal from './ui/Modal'
import RatingPicker from './ui/RatingPicker'
import BusinessAutocomplete, { type Suggestion } from './ui/BusinessAutocomplete'
import PhotoUpload from './ui/PhotoUpload'
import WingFlavorPicker from './ui/WingFlavorPicker'
import { useAuthContext } from './AuthProvider'
import { useHideFab } from '../hooks/useHideFab'
import { holdBadgeAnnouncements } from '../lib/badgeUnlocks'
import { looksSignedOut, signedOutMessage } from '../lib/publishErrors'
import { rememberReturnTo } from '../lib/authReturn'
import { supabase } from '../lib/supabase'
import { formatVisitDate, localDateString } from '../lib/dates'
import type { ReviewCreateData } from '../lib/reviewActions'

interface PrefillSpot {
  shop_name: string
  address: string
  lat: string | number
  lng: string | number
  /** The existing spot being reviewed: the review is attached to it directly. */
  wing_spot_id?: string | null
}

interface EventContext {
  event_id: string
  event_stop_id: string
  event_name: string
}

interface Props {
  onClose: () => void
  onSubmit: (data: ReviewCreateData) => Promise<{ error: string | null; reviewId?: string }>
  prefill?: PrefillSpot
  eventContext?: EventContext
}

export const MAX_SPOT_NAME = 120
const MAX_ADDRESS = 200
// Earliest visit date we accept. Anything before is almost certainly a typo
// (QA published a review "visited" Jan 1, 1900).
export const MIN_VISIT_DATE = '2000-01-01'
export const MAX_REVIEW_TEXT = 500
// Show the character counter once the text gets this close to the limit.
const REVIEW_COUNTER_FROM = 400

/**
 * What's wrong with a visit date, or null. Shared with ReviewEditModal.
 * A year still being typed (the date input reports "0002-…", "0020-…")
 * isn't an error yet.
 */
export function visitDateProblem(value: string, today: string, { typing = false } = {}): string | null {
  if (!value) return 'Choose the date you visited.'
  if (typing && Number(value.slice(0, 4)) < 1000) return null
  if (value > today) return "The visit date can't be in the future. Choose today or an earlier date."
  if (value < MIN_VISIT_DATE) return `Choose a date on or after ${formatVisitDate(MIN_VISIT_DATE)}.`
  return null
}

export function reviewTextProblem(text: string): string | null {
  return text.length > MAX_REVIEW_TEXT
    ? `Your review is ${text.length - MAX_REVIEW_TEXT} characters too long. Shorten it to ${MAX_REVIEW_TEXT} characters.`
    : null
}

/** Live "n / 500" counter for review text; shown near the limit. */
export function ReviewTextCounter({ length, id }: { length: number; id: string }) {
  if (length < REVIEW_COUNTER_FROM) return null
  const over = length > MAX_REVIEW_TEXT
  return (
    <p id={id} className={`text-xs mt-1 text-right tabular-nums ${over ? 'text-red-600 font-bold' : 'text-charcoal-500'}`}>
      {length} / {MAX_REVIEW_TEXT}{over && ' — too long'}
    </p>
  )
}

/** Scroll a field into the middle of its sheet and focus it — used when a
 *  submit fails, so the error is never out of sight (m1 breaker 1). */
export function focusField(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  el.focus({ preventScroll: true })
}

// Words for the summary next to the submit button.
const FIELD_NAMES: Record<string, string> = {
  shopName: 'the spot name',
  address: 'the address',
  location: 'the location',
  lat: 'the latitude',
  lng: 'the longitude',
  rating: 'the rating',
  reviewText: 'your review text',
  visitedAt: 'the visit date',
}
// Field order on screen, and the element to focus for each.
const FIELD_TARGETS: Array<[string, string]> = [
  ['shopName', 'shop-search'],
  ['address', 'address'],
  ['location', 'address'],
  ['lat', 'lat'],
  ['lng', 'lng'],
  ['rating', 'review-rating'],
  ['reviewText', 'review-text'],
  ['visitedAt', 'visited'],
]

export function errorSummary(errors: Record<string, string>): string | null {
  const names = FIELD_TARGETS.filter(([k]) => errors[k]).map(([k]) => FIELD_NAMES[k])
  const unique = names.filter((n, i) => names.indexOf(n) === i)
  if (unique.length === 0) return null
  const list = unique.length === 1
    ? unique[0]
    : `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`
  return `Check ${list} above.`
}

function focusFirstError(errors: Record<string, string>) {
  const first = FIELD_TARGETS.find(([k]) => errors[k])
  if (first) requestAnimationFrame(() => focusField(first[1]))
}

// ── Draft persistence ─────────────────────────────────────────────────────
// Browser Back, a refresh or an accidental close used to throw the whole
// review away. Keep a draft in sessionStorage (per tab), keyed by user and
// by what's being reviewed so drafts never leak across accounts or spots.
// Photos are File objects and can't be stored; we only remember how many.

interface Draft {
  v: 1
  shopName: string
  address: string
  lat: string
  lng: string
  locationPicked: boolean
  onWingMap: boolean
  /** Id of the existing spot picked from the suggestions (older drafts lack it). */
  spotId?: string | null
  showCoords: boolean
  overallRating: number
  wingSize: string
  wingFlavor: string
  isTakeout: boolean
  takeoutContainer: string
  reviewText: string
  visitedAt: string
  step: 1 | 2
  photoCount: number
}

function draftKey(userId: string | undefined, prefill?: PrefillSpot, eventContext?: EventContext): string {
  const context = eventContext
    ? `event:${eventContext.event_stop_id}`
    : prefill
      ? `spot:${prefill.shop_name}|${prefill.address}`
      : 'new'
  return `wingmap:review-draft:${userId ?? 'anon'}:${context}`
}

function readDraft(key: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw) as Draft
    return d && d.v === 1 ? d : null
  } catch {
    return null
  }
}

function writeDraft(key: string, draft: Draft) {
  try { sessionStorage.setItem(key, JSON.stringify(draft)) } catch { /* storage full / blocked */ }
}

function clearDraft(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* ignore */ }
}

// Delay between the "Review published" confirmation and any badge overlay.
const BADGES_AFTER_PUBLISH_MS = 1200

// Pending "draft saved" toast, cancelled if the modal remounts immediately
// (React StrictMode mounts effects twice in development).
let draftSavedToastTimer: ReturnType<typeof setTimeout> | null = null

// ── Location helpers ──────────────────────────────────────────────────────

function parseCoord(value: string, limit: number): number | null {
  if (!value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= -limit && n <= limit ? n : null
}

export function coordsAreValid(lat: string, lng: string): boolean {
  return parseCoord(lat, 90) !== null && parseCoord(lng, 180) !== null
}

// Raw database / network errors aren't useful to a reviewer. (Signed-out
// errors are caught before this — see publishErrors.)
function friendlySubmitError(message: string): string {
  if (/violates|policy|duplicate key|pgrst|syntax|failed to fetch|network|timeout/i.test(message)) {
    return "Couldn't publish your review. Check your connection and try again."
  }
  return message
}

// Home's add-review modal is history-backed (useHistoryModal): closing it
// calls history.back(), which completes asynchronously. Navigating before
// that pop lands would have the pop undo our navigation, so wait for it.
function navigateAfterModalHistory(go: () => void) {
  const state = window.history.state as { _modal?: boolean } | null
  if (!state?._modal) {
    go()
    return
  }
  let done = false
  const finish = () => {
    if (done) return
    done = true
    window.removeEventListener('popstate', finish)
    clearTimeout(timer)
    go()
  }
  window.addEventListener('popstate', finish)
  const timer = setTimeout(finish, 1500)
}

export default function ReviewFormModal({ onClose, onSubmit, prefill, eventContext }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuthContext()
  const userId = auth?.user?.id
  const [storageKey] = useState(() => draftKey(userId, prefill, eventContext))
  const [initialDraft] = useState(() => readDraft(storageKey))
  const d = initialDraft

  // Computed at open time, not module load — a module-level constant goes
  // stale when the app stays open across midnight. Local date, never
  // toISOString() (that rolls over to tomorrow in the evening west of UTC).
  const [today] = useState(() => localDateString())
  const [shopName, setShopName] = useState(prefill?.shop_name ?? d?.shopName ?? '')
  const [address, setAddress] = useState(prefill?.address ?? d?.address ?? '')
  const [lat, setLat] = useState(prefill ? String(prefill.lat) : d?.lat ?? '')
  const [lng, setLng] = useState(prefill ? String(prefill.lng) : d?.lng ?? '')
  // True when the coordinates came from a suggestion or "Find". Only then is
  // the address block collapsed into a summary card; typing never collapses it.
  const [locationPicked, setLocationPicked] = useState(d?.locationPicked ?? false)
  const [onWingMap, setOnWingMap] = useState(d?.onWingMap ?? false)
  // The existing spot the user picked ("Already on WingKingTony"). Sent with
  // the review so it lands on exactly that spot, never a look-alike new one
  // (m2 S03: a stored name with a trailing space didn't match by name).
  const [spotId, setSpotId] = useState<string | null>(prefill?.wing_spot_id ?? d?.spotId ?? null)
  const [showCoords, setShowCoords] = useState(d?.showCoords ?? false)
  const [overallRating, setOverallRating] = useState(d?.overallRating ?? 0)
  const [wingSize, setWingSize] = useState(d?.wingSize ?? '')
  const [wingFlavor, setWingFlavor] = useState(d?.wingFlavor ?? '')
  const [isTakeout, setIsTakeout] = useState(d?.isTakeout ?? false)
  const [takeoutContainer, setTakeoutContainer] = useState(d?.takeoutContainer ?? '')
  const [reviewText, setReviewText] = useState(d?.reviewText ?? '')
  const [visitedAt, setVisitedAt] = useState(d?.visitedAt ?? today)
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  // Set (synchronously) just before navigating to the new review: the sheet
  // leaves the screen first. See handleSubmit.
  const [published, setPublished] = useState(false)
  // The session ended before Publish (e.g. signed out in another tab).
  const [signedOut, setSignedOut] = useState(false)
  useHideFab(!published)
  // When pre-filled (e.g. checking in at an event stop) we skip step 1.
  const [step, setStep] = useState<1 | 2>(prefill ? 2 : d?.step ?? 1)
  const [geoLoading, setGeoLoading] = useState(false)
  const [findError, setFindError] = useState<string | null>(null)
  const [draftNote, setDraftNote] = useState<{ photoCount: number } | null>(
    d ? { photoCount: d.photoCount } : null
  )
  // Per-field errors (cleared as soon as the user edits the field).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const setError = (key: string, message: string | null) =>
    setFieldErrors(prev => {
      if (!message) {
        if (!prev[key]) return prev
        const rest = { ...prev }
        delete rest[key]
        return rest
      }
      return prev[key] === message ? prev : { ...prev, [key]: message }
    })
  const clearError = (...keys: string[]) =>
    setFieldErrors(prev => {
      if (!keys.some(k => prev[k])) return prev
      const rest = { ...prev }
      for (const k of keys) delete rest[k]
      return rest
    })

  const coordsValid = coordsAreValid(lat, lng)
  const locationCollapsed = locationPicked && coordsValid

  // Track whether the user has put real input in — used for the discard
  // guard, the unload warning and the draft.
  const isDirty =
    overallRating > 0
    || !!wingFlavor
    || !!wingSize
    || isTakeout
    || !!reviewText.trim()
    || photos.length > 0
    || (!prefill && (!!shopName.trim() || !!address.trim()))

  const submittedRef = useRef(false)
  // A parent may close the modal as soon as its save succeeds but before
  // onSubmit resolves (SpotPage reloads the page data first), so an in-flight
  // publish must not count as "closed without publishing".
  const publishingRef = useRef(false)
  const discardedRef = useRef(false)
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty

  // Save the draft on every change; drop it once nothing is left to save.
  useEffect(() => {
    if (submittedRef.current || discardedRef.current) return
    if (!isDirty) {
      clearDraft(storageKey)
      return
    }
    writeDraft(storageKey, {
      v: 1,
      shopName, address, lat, lng, locationPicked, onWingMap, spotId, showCoords,
      overallRating, wingSize, wingFlavor, isTakeout, takeoutContainer,
      reviewText, visitedAt, step, photoCount: photos.length,
    })
  }, [
    storageKey, isDirty, shopName, address, lat, lng, locationPicked, onWingMap, spotId, showCoords,
    overallRating, wingSize, wingFlavor, isTakeout, takeoutContainer, reviewText,
    visitedAt, step, photos.length,
  ])

  // Warn before a refresh / tab close throws away unsaved input (photos
  // can't be kept in the draft).
  useEffect(() => {
    if (!isDirty || submitting) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, submitting])

  // Closed without publishing or discarding (e.g. browser Back): tell the
  // user their input is still there.
  useEffect(() => {
    if (draftSavedToastTimer) {
      clearTimeout(draftSavedToastTimer)
      draftSavedToastTimer = null
    }
    return () => {
      if (!dirtyRef.current || submittedRef.current || discardedRef.current || publishingRef.current) return
      draftSavedToastTimer = setTimeout(() => {
        draftSavedToastTimer = null
        // Re-check: a publish that closes the modal may finish just after unmount.
        if (submittedRef.current || discardedRef.current || publishingRef.current) return
        toast('Your review is saved as a draft. Open the review form again to finish it.', { duration: 5000 })
      }, 0)
    }
  }, [])

  const resetForm = () => {
    setShopName(prefill?.shop_name ?? '')
    setAddress(prefill?.address ?? '')
    setLat(prefill ? String(prefill.lat) : '')
    setLng(prefill ? String(prefill.lng) : '')
    setLocationPicked(false)
    setOnWingMap(false)
    setSpotId(prefill?.wing_spot_id ?? null)
    setShowCoords(false)
    setOverallRating(0)
    setWingSize('')
    setWingFlavor('')
    setIsTakeout(false)
    setTakeoutContainer('')
    setReviewText('')
    setVisitedAt(today)
    setPhotos([])
    setStep(prefill ? 2 : 1)
    setFindError(null)
    setFieldErrors({})
  }

  const discardDraft = () => {
    clearDraft(storageKey)
    resetForm()
    setDraftNote(null)
  }

  const handleCloseAttempt = () => {
    // Closing mid-publish would leave the user unsure whether it went out.
    if (submitting) return
    if (isDirty) {
      const ok = window.confirm('Discard your review? Anything you entered will be lost.')
      if (!ok) return
    }
    discardedRef.current = true
    clearDraft(storageKey)
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
    setFindError(null)
    clearError('location', 'address')
    try {
      const encoded = encodeURIComponent(address.trim())
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
        { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json() as Array<{ lat: string; lon: string }>
      const foundLat = data[0] ? parseFloat(data[0].lat) : NaN
      const foundLng = data[0] ? parseFloat(data[0].lon) : NaN
      if (Number.isFinite(foundLat) && Number.isFinite(foundLng)) {
        setLat(foundLat.toFixed(6))
        setLng(foundLng.toFixed(6))
        setLocationPicked(true)
        clearError('lat', 'lng')
      } else {
        setFindError("We couldn't find that address. Check the spelling, or enter the coordinates manually.")
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return
      setFindError("Address search isn't working right now. Try again, or enter the coordinates manually.")
    } finally {
      if (geoAbortRef.current === controller) setGeoLoading(false)
    }
  }

  const handleAutocompleteSelect = (suggestion: Suggestion) => {
    setShopName(suggestion.name.slice(0, MAX_SPOT_NAME))
    setAddress(suggestion.address)
    if (suggestion.source === 'wingmap') {
      // Keep the stored values; the review is attached to the picked spot
      // by its id (spotId below), so nothing new gets created.
      setLat(suggestion.lat)
      setLng(suggestion.lng)
    } else {
      setLat(parseFloat(suggestion.lat).toFixed(6))
      setLng(parseFloat(suggestion.lng).toFixed(6))
    }
    setOnWingMap(suggestion.source === 'wingmap')
    setSpotId(suggestion.source === 'wingmap' ? suggestion.spotId ?? null : null)
    setLocationPicked(true)
    setFindError(null)
    setFieldErrors({})
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!shopName.trim()) errs.shopName = 'Enter the name of the wing spot.'
    if (!address.trim()) errs.address = 'Enter the address.'

    const latEmpty = !lat.trim()
    const lngEmpty = !lng.trim()
    if (latEmpty && lngEmpty) {
      errs.location = 'We need the location. Choose a suggestion from the list, or type the address and press Find.'
    } else {
      if (parseCoord(lat, 90) === null) errs.lat = 'Latitude must be a number from -90 to 90.'
      if (parseCoord(lng, 180) === null) errs.lng = 'Longitude must be a number from -180 to 180.'
      if (errs.lat || errs.lng) setShowCoords(true)
    }

    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      focusFirstError(errs)
      return
    }
    setFieldErrors({})
    setStep(2)
  }

  // Sign in again without losing the review: the draft is already saved,
  // and auth brings the user back to this page afterwards.
  // They already have an account, so go straight to /login.
  const goSignIn = async () => {
    const here = location.pathname + location.search
    if (auth?.user) {
      // The app still thinks we're signed in (an expired token the server
      // rejected): drop that dead session first, or /login bounces back here.
      try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* already gone */ }
    }
    rememberReturnTo(here)
    // Close the sheet (keeping the draft) and wait for its history entry to
    // pop, or that pop would undo the navigation.
    onClose()
    navigateAfterModalHistory(() => navigate('/login'))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const errs: Record<string, string> = {}
    if (overallRating === 0) errs.rating = 'Choose a rating from 1 to 10.'
    const textProblem = reviewTextProblem(reviewText)
    if (textProblem) errs.reviewText = textProblem
    const dateProblem = visitDateProblem(visitedAt, today)
    if (dateProblem) errs.visitedAt = dateProblem
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      focusFirstError(errs)
      return
    }
    // Signed out in another tab: don't send a request that can only fail.
    if (auth && !auth.user) {
      setSignedOut(true)
      return
    }
    setSignedOut(false)
    setSubmitting(true)
    publishingRef.current = true
    // Badge unlocks wait until the sheet is gone and "published" is shown.
    const releaseBadges = holdBadgeAnnouncements()
    let result: { error: string | null; reviewId?: string }
    try {
      result = await onSubmit({
        wing_spot_id: spotId,
        shop_name: shopName.trim(),
        address: address.trim(),
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
    } catch {
      result = { error: 'network' }
    }
    setSubmitting(false)
    publishingRef.current = false
    if (result.error) {
      releaseBadges()
      if (looksSignedOut(result.error)) {
        setSignedOut(true)
        return
      }
      toast.error(friendlySubmitError(result.error))
      return
    }
    submittedRef.current = true
    clearDraft(storageKey)
    // Confirm first; any badges follow once the confirmation has been seen.
    const confirmationToastId = eventContext
      // Event check-ins stay on the event page; the parent closes the modal.
      ? toast.success(`Review published for ${eventContext.event_name}. 🍗`, { duration: 5000 })
      : toast.success('Review published! 🍗', { duration: 5000 })
    setTimeout(
      () => releaseBadges({ reviewPublished: true, confirmationToastId: confirmationToastId || undefined }),
      BADGES_AFTER_PUBLISH_MS
    )
    if (eventContext) return
    if (result.reviewId) {
      const reviewId = result.reviewId
      // Take the sheet off screen before navigating. The review page is
      // lazy-loaded: while its code downloads, Suspense only hides the old
      // page, and this portaled sheet stayed on top of the new URL with a
      // stale "Publishing…" button for up to a second (r3 mobile 3).
      flushSync(() => setPublished(true))
      navigateAfterModalHistory(() => navigate(`/reviews/${reviewId}`))
    }
  }

  const draftBanner = draftNote && (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-cream-100 border border-night-900/10 px-3 py-1 text-xs text-charcoal-600" role="status">
      <span>
        Draft restored
        {draftNote.photoCount > 0 && ' · Please add your photos again'}
      </span>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={discardDraft}
        className="min-h-[44px] font-bold text-sauce-600 hover:text-sauce-700 underline underline-offset-2"
      >
        Discard
      </button>
    </div>
  )

  const summary = errorSummary(fieldErrors)
  const summaryLine = summary && (
    <p className="text-xs font-bold text-red-600 text-center" role="status">{summary}</p>
  )

  const step1Footer = (
    <div className="space-y-2">
      {summaryLine}
      <button type="submit" form="review-step-1" className="btn-primary w-full">
        Next →
      </button>
    </div>
  )

  const step2Footer = (
    <div className="space-y-2">
      {signedOut ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 border-red-600/40 bg-red-50 px-3 py-2" role="alert">
          <p className="flex-1 min-w-[12rem] text-xs font-bold text-night-800">{signedOutMessage(photos.length > 0)}</p>
          <button type="button" onClick={() => void goSignIn()} className="btn-primary px-4 min-h-[44px] text-xs">
            Sign in
          </button>
        </div>
      ) : summaryLine || (
        <p className="text-xs text-charcoal-500 text-center">
          {overallRating === 0 && <span>Choose a rating to publish your review. </span>}
          <span>Your review and photos will be public.</span>
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleCloseAttempt}
          disabled={submitting}
          className="btn-secondary px-5"
        >
          Cancel
        </button>
        <button
          type="submit"
          form="review-step-2"
          disabled={submitting || overallRating === 0}
          className="btn-primary flex-1 whitespace-nowrap"
        >
          {submitting ? 'Publishing…' : 'Publish review'}
        </button>
      </div>
    </div>
  )

  if (published) return null

  return (
    <Modal
      title={eventContext ? `Review for ${eventContext.event_name}` : 'Add a review'}
      onClose={handleCloseAttempt}
      size="md"
      footer={step === 1 ? step1Footer : step2Footer}
    >
      {step === 1 ? (
        <form id="review-step-1" onSubmit={handleNext} noValidate className="px-6 py-5 space-y-4">
          {draftBanner}
          <p className="text-xs text-charcoal-400 font-medium uppercase tracking-widest">
            Step 1 of 2 — Where did you eat?
          </p>

          {/* Autocomplete search */}
          <div>
            <label className="label" htmlFor="shop-search">Wing spot name</label>
            <BusinessAutocomplete
              id="shop-search"
              value={shopName}
              maxLength={MAX_SPOT_NAME}
              // Typing here is how the address and location get filled in
              // (pick a suggestion), so their old errors go too (m1 N10/B14).
              onChange={v => { setShopName(v); setOnWingMap(false); setSpotId(null); clearError('shopName', 'address', 'location') }}
              onSelect={handleAutocompleteSelect}
              placeholder="Type a name, e.g. Wingstop"
              revealOnFocus
            />
            <p className="text-xs text-charcoal-500 mt-1">
              Start typing to search. Spots already on WingKingTony show first.
            </p>
            {fieldErrors.shopName && (
              <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.shopName}</p>
            )}
          </div>

          {locationCollapsed ? (
            <div className="bg-cream-100 rounded-2xl px-4 py-3 space-y-0.5 border border-night-900/10 min-w-0">
              <p className="text-xs font-bold text-sauce-600 flex items-center gap-1">
                <span aria-hidden>✓</span> Location set{onWingMap && ' · Already on WingKingTony'}
              </p>
              <p className="text-sm font-bold text-night-800 break-words">{address}</p>
              {onWingMap && (
                <p className="text-xs text-charcoal-500">Your review will be added to this spot.</p>
              )}
              <button
                type="button"
                onClick={() => setLocationPicked(false)}
                className="min-h-[44px] text-xs font-extrabold uppercase tracking-crowd text-sauce-500 hover:text-sauce-600 transition-colors"
              >
                Change address
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
                    className="input flex-1 min-w-0"
                    value={address}
                    maxLength={MAX_ADDRESS}
                    onChange={e => {
                      setAddress(e.target.value)
                      setLocationPicked(false)
                      setOnWingMap(false)
                      setSpotId(null)
                      setFindError(null)
                      clearError('address', 'location')
                    }}
                    onKeyDown={e => {
                      // Enter in the address box means "Find", not "Next".
                      if (e.key === 'Enter' && address.trim()) {
                        e.preventDefault()
                        void geocodeAddress()
                      }
                    }}
                    placeholder="Street, city"
                    aria-invalid={!!(fieldErrors.address || fieldErrors.location || findError) || undefined}
                    aria-describedby="address-help"
                  />
                  <button
                    type="button"
                    onClick={geocodeAddress}
                    disabled={geoLoading || !address.trim()}
                    className="btn-secondary px-3 py-3 min-h-[44px] text-xs whitespace-nowrap flex-shrink-0"
                  >
                    {geoLoading ? 'Finding…' : 'Find'}
                  </button>
                </div>
                <div id="address-help">
                  {fieldErrors.address && (
                    <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.address}</p>
                  )}
                  {findError && (
                    <p className="text-xs text-red-600 mt-1" role="alert">{findError}</p>
                  )}
                  {fieldErrors.location && !findError && (
                    <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.location}</p>
                  )}
                  {coordsValid && !findError && !fieldErrors.location && (
                    <p className="text-xs text-sauce-600 mt-1 flex items-center gap-1">
                      <span aria-hidden>✓</span> Location set
                    </p>
                  )}
                  {!coordsValid && !findError && !fieldErrors.location && !fieldErrors.address && (
                    <p className="text-xs text-charcoal-500 mt-1">
                      Type the address and press Find.
                    </p>
                  )}
                </div>
              </div>

              {showCoords ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="lat">Latitude</label>
                      <input
                        id="lat"
                        type="text"
                        inputMode="decimal"
                        className="input"
                        value={lat}
                        onChange={e => { setLat(e.target.value); setLocationPicked(false); clearError('lat', 'location') }}
                        placeholder="-90 to 90"
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
                        type="text"
                        inputMode="decimal"
                        className="input"
                        value={lng}
                        onChange={e => { setLng(e.target.value); setLocationPicked(false); clearError('lng', 'location') }}
                        placeholder="-180 to 180"
                        aria-invalid={!!fieldErrors.lng || undefined}
                      />
                      {fieldErrors.lng && (
                        <p className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.lng}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCoords(false)}
                    className="min-h-[44px] text-xs text-charcoal-500 hover:text-charcoal-600 underline underline-offset-2 transition-colors"
                  >
                    Hide coordinates
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCoords(true)}
                  className="min-h-[44px] text-xs text-charcoal-500 hover:text-charcoal-600 underline underline-offset-2 transition-colors"
                >
                  Enter coordinates manually
                </button>
              )}
            </div>
          )}
        </form>
      ) : (
        <form id="review-step-2" onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-5">
          {draftBanner}
          <div className="flex items-center gap-2">
            {!prefill && (
              <button
                type="button"
                onClick={() => { setStep(1); setFieldErrors({}) }}
                className="min-h-[44px] px-2 -ml-2 text-sm font-bold text-charcoal-500 hover:text-charcoal-600 transition-colors"
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
              <p className="text-sm font-bold text-night-800 break-words">{eventContext.event_name}</p>
              <p className="text-xs text-charcoal-500">This review will be tagged with the event.</p>
            </div>
          )}

          <div className="bg-cream-100 rounded-2xl px-4 py-3 border border-night-900/10 min-w-0">
            <p className="font-bold text-night-800 text-sm break-words">{shopName}</p>
            <p className="text-xs text-charcoal-500 mt-0.5 break-words">{address}</p>
          </div>

          <div>
            <RatingPicker
              id="review-rating"
              value={overallRating}
              onChange={v => { setOverallRating(v); clearError('rating') }}
              accent="amber"
              icon="🍗"
              label="Wing rating"
              aria-describedby={fieldErrors.rating ? 'review-rating-error' : undefined}
            />
            {fieldErrors.rating && (
              <p id="review-rating-error" className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.rating}</p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="wing-size">Wing size (optional)</label>
            <select
              id="wing-size"
              className="input"
              value={wingSize}
              onChange={e => setWingSize(e.target.value)}
            >
              <option value="">Choose a size…</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="jumbo">Jumbo</option>
            </select>
          </div>

          <div>
            <label className="label">Flavor (optional)</label>
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
              <div className={`relative w-11 h-6 rounded-full transition-colors duration-150 flex-shrink-0 ${isTakeout ? 'bg-sauce-400' : 'bg-night-900/20'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-150 ${isTakeout ? 'translate-x-[22px]' : 'translate-x-0'}`} />
              </div>
              <span className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-600">Takeout</span>
              <span className="text-xs text-charcoal-500">I ordered the food to go</span>
            </label>
          </div>

          {isTakeout && (
            <div>
              <label className="label" htmlFor="takeout-container">Takeout container (optional)</label>
              <select
                id="takeout-container"
                className="input"
                value={takeoutContainer}
                onChange={e => setTakeoutContainer(e.target.value)}
              >
                <option value="">Choose a container…</option>
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
            <label className="label" htmlFor="review-text">Your review (optional)</label>
            {/* No maxLength: it silently cut pasted text (m1 breaker 6). The
                counter and the Publish check say when it's too long. */}
            <textarea
              id="review-text"
              className="input resize-none"
              rows={4}
              value={reviewText}
              onChange={e => {
                setReviewText(e.target.value)
                if (!reviewTextProblem(e.target.value)) clearError('reviewText')
              }}
              placeholder="What did you think of the wings?"
              aria-invalid={!!fieldErrors.reviewText || undefined}
              aria-describedby="review-text-count review-text-error"
            />
            <ReviewTextCounter length={reviewText.length} id="review-text-count" />
            {fieldErrors.reviewText && (
              <p id="review-text-error" className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.reviewText}</p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="visited">Date you visited</label>
            <input
              id="visited"
              type="date"
              className="input"
              value={visitedAt}
              onChange={e => {
                // Check as soon as a full date is in: the browser lets you
                // type past `max` (m1 breaker 1).
                setVisitedAt(e.target.value)
                setError('visitedAt', visitDateProblem(e.target.value, today, { typing: true }))
              }}
              onBlur={e => setError('visitedAt', visitDateProblem(e.target.value, today))}
              min={MIN_VISIT_DATE}
              max={today}
              required
              aria-invalid={!!fieldErrors.visitedAt || undefined}
              aria-describedby={fieldErrors.visitedAt ? 'visited-error' : undefined}
            />
            {fieldErrors.visitedAt && (
              <p id="visited-error" className="text-xs text-red-600 mt-1" role="alert">{fieldErrors.visitedAt}</p>
            )}
          </div>

          <div>
            <label className="label">Photos (optional)</label>
            <PhotoUpload files={photos} onChange={setPhotos} />
          </div>
        </form>
      )}
    </Modal>
  )
}
