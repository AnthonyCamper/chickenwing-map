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
  const { data, error } = await supabase
    .from('badges_for_user')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error || !data) return
  const fresh = (data as BadgeWithEarned[]).filter(b => b.earned && !before.has(b.id))
  if (fresh.length === 0) return
  window.dispatchEvent(
    new CustomEvent<BadgesUnlockedDetail>(BADGES_UNLOCKED_EVENT, { detail: { badges: fresh } })
  )
}
