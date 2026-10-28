import { supabase } from './supabase'
import type { BadgeWithEarned } from './types'

/**
 * Badge unlock announcements.
 *
 * Badges are awarded server-side by DB triggers (award_user_badges) when a
 * review or crawl is written, so the client discovers new unlocks by
 * snapshotting the earned set before the action and diffing after. The diff
 * is id-based (never timestamp-based) so client/server clock skew can't
 * hide or duplicate an unlock.
 *
 * New unlocks are broadcast as a window event; BadgeUnlockOverlay (mounted
 * once in App) listens and shows the "Badge unlocked!" celebration.
 */

export const BADGES_UNLOCKED_EVENT = 'badges-unlocked'

export interface BadgesUnlockedDetail {
  badges: BadgeWithEarned[]
  /** Set when the unlocks came from publishing a review, so the overlay
   *  can confirm the review went live before celebrating. */
  reviewPublished?: boolean
  /** The "Review published" toast the overlay takes over from: it's
   *  dismissed so it doesn't sit on top of the overlay's buttons. */
  confirmationToastId?: string
}

// ── Holding announcements back ───────────────────────────────────────────
// The review form publishes, then closes its sheet and confirms "Review
// published". Unlocks found while that is still happening used to pop the
// badge overlay over a sheet still saying "Publishing…" (m1 mobile 11). The
// form holds announcements for the duration and releases them once the
// confirmation is on screen.

interface ReleaseOptions {
  reviewPublished?: boolean
  confirmationToastId?: string
}

interface Hold {
  released: boolean
  queued: BadgeWithEarned[]
  context: ReleaseOptions
}

let activeHold: Hold | null = null

// Never sit on unlocks forever if a release is somehow missed.
const MAX_HOLD_MS = 20_000

function dispatch(badges: BadgeWithEarned[], context: ReleaseOptions) {
  if (badges.length === 0) return
  const detail: BadgesUnlockedDetail = { badges }
  if (context.reviewPublished) detail.reviewPublished = true
  if (context.confirmationToastId) detail.confirmationToastId = context.confirmationToastId
  window.dispatchEvent(new CustomEvent<BadgesUnlockedDetail>(BADGES_UNLOCKED_EVENT, { detail }))
}

/**
 * Queue badge announcements until the returned `release` is called. Unlocks
 * computed after the release (the diff is a network round-trip) are shown
 * right away, still tagged with the release's context.
 */
export function holdBadgeAnnouncements(): (opts?: ReleaseOptions) => void {
  const hold: Hold = { released: false, queued: [], context: {} }
  activeHold = hold
  const release = (opts?: ReleaseOptions) => {
    if (hold.released) return
    hold.released = true
    hold.context = opts ?? {}
    clearTimeout(timer)
    if (activeHold === hold) activeHold = null
    const queued = hold.queued
    hold.queued = []
    dispatch(queued, hold.context)
  }
  const timer = setTimeout(() => release(), MAX_HOLD_MS)
  return release
}

/** Earned badge ids right now — call BEFORE an action that can award. */
export async function snapshotEarnedBadgeIds(): Promise<Set<string> | null> {
  const { data, error } = await supabase
    .from('badges_for_user')
    .select('id, earned')
  if (error || !data) return null
  return new Set(data.filter(b => b.earned).map(b => b.id as string))
}

/**
 * Diff the current earned set against a pre-action snapshot and announce
 * anything new. No-op when the snapshot failed (null) — better to miss a
 * popup than to spam every already-earned badge.
 */
export async function announceNewBadges(before: Set<string> | null): Promise<void> {
  if (!before) return
  // The hold that was active when the action ran, even if it's released by
  // the time the diff comes back.
  const hold = activeHold
  const { data, error } = await supabase
    .from('badges_for_user')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error || !data) return
  const fresh = (data as BadgeWithEarned[]).filter(b => b.earned && !before.has(b.id))
  if (fresh.length === 0) return
  if (hold && !hold.released) {
    hold.queued.push(...fresh)
    return
  }
  dispatch(fresh, hold?.context ?? {})
}
