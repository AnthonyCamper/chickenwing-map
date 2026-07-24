# Badge System: Fun, Rarity & Event Exclusives — Design

**Date:** 2026-07-24
**Goal:** Make earning and viewing badges exciting: a celebration popup worth
screenshotting, clear "this came from an exclusive event" signaling, and badge
displays on profiles that people actually want to browse.

## Problems today

1. **Event badges look identical to regular badges.** `badges.event_id` exists
   but no UI surfaces it — an exclusive crawl badge renders exactly like
   "posted 5 reviews".
2. **The unlock popup is static.** Two emoji pinned to a card corner; no motion,
   no context on why the badge is cool.
3. **No rarity.** With 34 members and 226 earns, "only 2 people have this" is a
   great brag — but the data isn't exposed anywhere.
4. **Profile badge strips render `badge.icon` raw** (`{b.icon}`), which shows
   slug text like `north-star` for the custom SVG icon set (bug).
5. **Flat badge grid** — no grouping, earned date hidden until you open the
   detail modal.

## Design

### 1. Data: rarity + event context (migration 027)

- New view `badge_earn_stats` (security_invoker, matching migration 022
  conventions): one row per active badge — `badge_id`, `earned_count`
  (count of `user_badges` rows), `member_count` (approved profiles).
  RLS on `user_badges`/`profiles` already permits reads for approved users or
  public site, so an invoker view is correct.
- `badges_for_user` gains appended columns (CREATE OR REPLACE keeps existing
  column order): `earned_count`, `member_count`, `event_name`, `event_slug`
  (left join `events`). Client hooks pick these up with zero query changes.
- Rollback file mirrors `supabase/rollback/` conventions.

### 2. Rarity model (`src/lib/badgeRarity.ts`)

Pure function `badgeRarity(earnedCount, memberCount)` → tier:

| Tier | Rule (pct = earned/members) |
|---|---|
| `first` | earned_count ≤ 1 (you/they are the only one) |
| `legendary` | pct ≤ 10% |
| `rare` | pct ≤ 25% |
| `uncommon` | pct ≤ 50% |
| `common` | otherwise |

Returns `{ tier, label, pct, earnedCount, memberCount }`; null when stats are
missing (older cached rows) so every consumer degrades gracefully.

### 3. Event-exclusive visual language

Gold = event exclusive, everywhere:

- **BadgePill:** earned event badges get gold border + `shadow-sticker-gold`
  and a tiny gold star chip; locked event badges keep the lock but show a gold
  dashed border so members can tell an exclusive from a regular locked badge.
- **BadgeDetailModal:** event badges get a gold plate, an "Event exclusive"
  eyebrow, and a "Earned at {event} →" link to `/events/{slug}`. All badges get
  a rarity row: tier chip + "N of M members have this".
- **BadgeUnlockOverlay:** event badges celebrate in gold.

### 4. Unlock celebration (BadgeUnlockOverlay)

- Confetti burst: ~26 CSS particles (sauce/gold/cream/sky palette) with
  deterministic per-index trajectories, fired on each badge reveal.
- Rotating starburst rays behind the badge plate.
- Springy pop-in for the plate (scale overshoot + slight rotation), staggered
  text reveal.
- Haptic buzz via `navigator.vibrate` where supported.
- Rarity callout: "You're the first to earn this!" / "Legendary — only 6% of
  members have this".
- Event callout: gold "Event exclusive" ribbon when `event_id` set.
- Keeps existing queue behavior ("2 of 3"), key handling, and the
  `badges-unlocked` window-event contract.

### 5. Profile display

- **UserProfilePage:** badges section splits into "Event exclusives" (gold
  heading) and "Badges". Rarity stats merged in from `badge_earn_stats` +
  event names from `events` (two extra parallel queries). Header mini-icons
  render through `BadgeIcon` (fixes slug-text bug).
- **ProfileModal (own profile):** badges tab groups earned into the same two
  sections; locked section unchanged. Header strip icon fix as above.
- **BadgeGrid** stays dumb; grouping happens in callers.

## Out of scope (YAGNI)

- Badge showcase/pinning, share cards, sounds, push notifications on unlock,
  per-badge pages. All can layer on later without schema changes.

## Testing

- Unit: `badgeRarity` tiers/edge cases; BadgePill event variant; overlay shows
  name, rarity + event callouts on a fired unlock event.
- Manual: build + existing vitest suite must pass (Node 22 via nvm).
