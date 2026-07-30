# Event Page Lifecycle Rework — Design Spec

**Date:** 2026-07-29
**Status:** Approved (brainstorming session)
**Context:** UX review of https://wingkingtony.com/events/2026-chicken-wing-crawl-ottawa found the page renders every module at full weight regardless of event state — triple title above the fold, "0 STOPS" + boilerplate empty route, a 20-pill gray locked badge wall, buried social proof, and a hard login wall on shared links. Root cause: no notion of event *phase*. This spec makes phase the organizing concept.

## Goals

- The page reads like a human edited it for the moment it's in: hype before the route, logistics during, celebration after.
- Shared links convert: logged-out friends see what they were invited to.
- Event badges stay meaningful: no couch check-ins a week early.
- Copy stays in the brand voice everywhere, including empty states.

## Non-goals

- No redesign of the visual system (cream/red/black sticker aesthetic stays).
- No changes to the badge engine, award triggers, or badge definitions.
- No changes to EventsIndex, CrawlEditor, or user-created crawls (`CrawlPage`).

## 1. Phase model

New pure helper `src/lib/eventPhase.ts`:

```ts
export type EventPhase = 'announced' | 'route_live' | 'crawl_day' | 'wrapped'

export function eventPhase(
  event: { starts_at: string | null; ends_at: string | null },
  stopCount: number,
  now?: Date,          // injectable for tests
): EventPhase
```

Rules (all local time):

- `announced` — no stops yet, and event window hasn't started.
- `route_live` — stops exist, `now` before start of `starts_at`'s day.
- `crawl_day` — `now` within `[startOfDay(starts_at), ends_at ?? endOfDay(starts_at)]`. Applies regardless of stop count (an event that starts with no stops published stays `announced` until stops exist or the window opens; if the window opens with zero stops it is `crawl_day` — the admin's problem to fix, not the page's).
- `wrapped` — `now` past the window.
- Null `starts_at`: treat as `announced`/`route_live` by stop count, never `crawl_day`/`wrapped`.

Derived, never stored. No migration, no cron, cannot go stale. `EventPage` computes it once per render from already-fetched data.

## 2. Module order per phase (mobile-first)

| # | announced | route_live | crawl_day | wrapped |
|---|-----------|------------|-----------|---------|
| 1 | Hero | Hero | Progress + next stop | Recap hero ("That's a wrap 🏁") |
| 2 | RSVP CTA | RSVP CTA | Route (check-ins live) | Crawl photos + reviews |
| 3 | Who's coming | Route (preview, locked check-ins) | Checked-in feed | Badge winners |
| 4 | Route teaser | Who's coming | Badge grid (full) | Final stats |
| 5 | Badge teaser | Badge teaser | Who's coming | Route (as record) |

Phase-specific behavior:

- **announced:** Route section is a hype teaser card — "📍 Route drops soon 👀" with sub-line "The stops are being scouted. RSVP so you don't miss the drop." The "0 stops" stat in the hero is replaced by "Route drops soon". No check-in UI anywhere.
- **route_live:** Route list + map as today, but check-in/review buttons render locked: "🔒 Unlocks Aug 8". Tapping shows a toast, not an error.
- **crawl_day:** "Your progress" card moves to slot 1 and gains a "next stop" line (first stop without a check-in). Check-in buttons live. Checked-in attendees list promoted above the badge grid.
- **wrapped:** RSVP module gone. Recap hero replaces the standard hero title treatment (same cover image, "That's a wrap 🏁" eyebrow, date in past tense). Photos/reviews: all reviews linked from this event's check-ins (`event_checkins.review_id`), shown as media-first cards. Badge winners: `user_badges` for this event grouped by badge, each with earner avatars. Final stats row: stops, total check-ins, reviews written, average rating.

Cross-phase fixes:

- The red "UPCOMING CRAWL" banner in `Layout`/`AppHeader` does not render when the current location is that event's own page.
- The sticky sub-bar keeps the share button but drops the duplicated event title on mobile (title lives in the hero card); on ≥sm it may keep a truncated title.
- Every empty state is written in brand voice. No "No X have been added yet." anywhere on this page.

## 3. Badge presentation

- **announced / route_live:** "Event badges" section shows 3 featured teaser cards + a "+N more to unlock" expander.
  - Featured pick order: the RSVP badge (criteria `event_rsvp`) first if present, then the 2 lowest-effort day-of badges (`event_checkin_count` count=1, `event_first_checkin`), falling back to definition order. Deterministic, no new schema.
  - Teaser card: real icon shown in color (not 🔒), name, one-line earn hint from the existing `howToEarn` mapping. Tappable → existing `BadgeDetailModal`.
  - Expander reveals the existing `BadgeGrid` inline (no navigation).
- **crawl_day / wrapped:** full `BadgeGrid` as today (earned states now light it up); wrapped adds the Badge winners module (separate from the grid).
- `BadgeGrid`/`BadgePill`/`BadgeDetailModal` internals unchanged.

## 4. Public preview (logged-out visitors)

- `App.tsx`: `/events/:slug` renders `EventPage` for `unauthenticated` as well (pending/rejected users keep current gates).
- Preview shows: hero (cover, name, date, description), going count, route (stop names + map; no check-in buttons), badge teasers, and a full-width "Sign in to join the crawl" CTA in place of the RSVP module. Who's-coming shows **count only** — no names or avatars for anon.
- Data access (migration `029`):
  - `events`: anon `SELECT` where `is_published = true` (independent of `site_settings.is_public`).
  - `event_stops`: anon `SELECT` where the parent event is published.
  - Going count: `SECURITY DEFINER` function `event_going_count(event_id uuid) returns int` so anon never reads `event_rsvps`/`profiles` rows.
  - `badges` scoped to a published event: anon `SELECT` (names/icons only are rendered).
  - No anon access to `event_checkins`, `user_badges`, `profiles`, or reviews. Wrapped-phase recap modules simply don't render for anon (preview shows hero + route + CTA).
- `EventPage` must therefore tolerate `userId == null` in every section (most already gate on `userId`).

## 5. Check-in gating (server + client)

- **Server (migration `029`):** replace the `event_checkins` INSERT policy so inserts are allowed only when `now()` is within `[startOfDay(starts_at), ends_at ?? endOfDay(starts_at)]` of the parent event — plus an admin bypass (`profiles.is_admin`) for testing. Badge award triggers fire on insert, so gating inserts gates badges.
- **Client:** in `route_live`, check-in buttons show "🔒 Unlocks {date}" (disabled style, toast on tap). The "Check in + review" combined button is likewise locked. In `announced` no check-in UI exists. In `crawl_day` everything works as today.
- Timezone note: client phase uses the viewer's local clock; the server policy uses the DB clock. A viewer with a skewed clock may see unlocked buttons early and get a friendly failure toast — acceptable.

## 6. Component split

`EventPage.tsx` (733 lines) becomes an orchestrator (~150 lines) + sections under `src/components/events/`:

- `EventHero.tsx` — cover, title, date, description, stats line (phase-aware stats).
- `EventRsvpPanel.tsx` — all three RSVP states + sign-in CTA for anon.
- `EventProgress.tsx` — progress bar + next-stop line (crawl_day).
- `EventRoute.tsx` — teaser card (announced) / map + stop list with lock state (route_live/crawl_day/wrapped).
- `EventBadges.tsx` — teaser cards + expander / full grid by phase.
- `EventAttendees.tsx` — who's coming chips (count-only for anon) + checked-in list.
- `EventRecap.tsx` — wrapped-only: recap hero treatment, photos/reviews, badge winners, stats.

Each takes plain props (`phase`, data, callbacks) — no new context. Existing hooks (`useEvent`-style data loading in EventPage) stay where they are.

## 7. Error handling

- Phase computation is total — any weird date data degrades to `announced`/`route_live`, never crashes.
- Locked check-in taps: toast "Check-ins unlock Aug 8 🍗", no request sent.
- Server rejection of an early check-in (clock skew): toast the policy error in friendly copy, re-disable button.
- Anon fetch failures on preview: fall back to hero + sign-in CTA (never a blank page).

## 8. Testing

- `eventPhase` unit tests: every boundary (no stops, stops+before, day start/end, ends_at multi-day, null dates), with injected `now`.
- Component tests (vitest + existing patterns): per-phase module presence/order — announced hides check-ins and shows teasers; route_live locks buttons; wrapped hides RSVP and shows recap.
- Migration verified against prod schema via Supabase MCP (policy dump before/after); early-insert rejection tested with the throwaway user.
- Browser smoke on the live site: logged-in (current phase = announced or route_live) + logged-out preview, mobile and desktop screenshots.

## 9. Rollout

- Single migration `029_event_checkin_gating_and_public_preview.sql` applied via Supabase MCP after code review.
- Frontend ships in one branch; no data backfill needed.
- After the Ottawa crawl wraps, the recap phase gets its first real-data check — worth a quick visual pass then.
