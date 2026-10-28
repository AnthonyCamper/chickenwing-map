import { MutableRefObject, Suspense, useEffect, useRef, useState } from 'react'
import { lazyWithReload } from '../lib/staleDeploy'
import { BADGES_UNLOCKED_EVENT } from '../lib/badgeUnlocks'

// The "Badge unlocked!" celebration (and its badge artwork) is only needed
// after a signed-in user publishes something, so it stays out of the first
// download (S26). Until its code has loaded, this catches the announcement
// and replays it once the overlay is listening.
const loadOverlay = () => import('./badges/BadgeUnlockOverlay')
const BadgeUnlockOverlay = lazyWithReload(loadOverlay)

/** Warm the overlay's code (e.g. once the user is signed in and idle). */
export const prefetchBadgeUnlockOverlay = loadOverlay

export default function LazyBadgeUnlockOverlay() {
  const [wanted, setWanted] = useState(false)
  const pending = useRef<Event[]>([])
  // Set once the real overlay is listening; from then on it handles events.
  const ready = useRef(false)

  useEffect(() => {
    const catchEarly = (e: Event) => {
      if (ready.current) return
      pending.current.push(new CustomEvent(e.type, { detail: (e as CustomEvent).detail }))
      setWanted(true)
    }
    window.addEventListener(BADGES_UNLOCKED_EVENT, catchEarly)
    return () => window.removeEventListener(BADGES_UNLOCKED_EVENT, catchEarly)
  }, [])

  if (!wanted) return null
  return (
    <Suspense fallback={null}>
      <BadgeUnlockOverlay />
      {/* After the overlay in the tree, so its listener (an effect) is
          attached by the time this replays what was caught. */}
      <Replay events={pending} ready={ready} />
    </Suspense>
  )
}

function Replay({ events, ready }: { events: MutableRefObject<Event[]>; ready: MutableRefObject<boolean> }) {
  useEffect(() => {
    ready.current = true
    const queued = events.current.splice(0)
    queued.forEach(e => window.dispatchEvent(e))
  }, [events, ready])
  return null
}
