# Ottawa Crawl Badges — Design

**Date:** 2026-07-23
**Event:** 2026 Chicken Wing Crawl Ottawa (`0663c3e0-1f6c-424b-8ad6-044652a0a194`, Aug 8 2026)

## Problem

The event-seed trigger auto-created 10 generic badges for the Ottawa crawl (same
names as the DC crawl: "I'm In", "Warming Up", "Crawl Champion"…) with emoji
icons. The Ottawa crawl should have its own identity: Canadian/Ottawa-themed
badge names that aren't corny, and custom drawn icons instead of emoji, styled
to match the site's sticker aesthetic (bold strokes, night/cream/sauce palette).

## Badge set

Criteria types and slugs are unchanged — only `name`, `description`, and `icon`
are re-themed. References are real Ottawa/Canada things, no "eh"/"sorry" jokes.

| Criteria | Name | Icon key | Reference |
|---|---|---|---|
| `event_rsvp` | True North | `north-star` | "True North strong and free" — you answered the call |
| `event_rsvp_with_guests` | Full Canoe | `canoe` | RSVPed with a crew — every seat paddling |
| `event_first_checkin` | Puck Drop | `puck` | First check-in of the whole crawl — opening faceoff |
| `event_checkin_count: 1` | The BeaverTail | `beavertail` | First stop down — the pastry invented in Ottawa |
| `event_checkin_count: 2` | Double Double | `double-double` | Two stops, smooth and steady |
| `event_checkin_count: 3` | Hat Trick | `hat-trick` | Three stops — the crowd throws hats |
| `event_checkin_count: 4` | The Portage | `portage` | Four stops deep and still carrying the boat |
| `event_review_count: 1` | Question Period | `peace-tower` | Went on the record — Parliament's daily grilling |
| `event_review_all` | The Hansard | `hansard` | Reviewed every stop you hit — the official record |
| `event_complete` | The Full Canal | `skate` | Every stop end to end, like skating the whole Rideau |

## Custom icon mechanism

- New `src/components/badges/BadgeIcon.tsx`: a registry mapping icon keys
  (e.g. `puck`, `canoe`) to hand-drawn 24×24 SVG components — stroke-based,
  `currentColor` strokes with a single sauce accent, round caps, matching the
  sticker style. The component renders the SVG when `badge.icon` is a known
  key, otherwise falls back to rendering the string (emoji) — so all existing
  badges keep working and can be migrated to custom icons incrementally.
- `BadgePill` and `BadgeDetailModal` (the only two `badge.icon` render sites)
  switch to `BadgeIcon`.

## Data change

Migration `025_ottawa_crawl_badges.sql`: `UPDATE badges` for the 10 Ottawa
slugs, setting the new names, descriptions, and icon keys. Applied to the live
project via the Supabase MCP and mirrored in `supabase/migrations/`.

## Canadiana badges (round 2)

17 additional global (non-event) fun badges with Ottawa/Canada references,
seeded by migration `026_canadiana_badges.sql`. Two new criteria types:

- `rating_exact` `{value}` — gave a review rated exactly that number. Used for
  rating easter eggs: **Confederation** (6.7 → 1867), **Canada Day** (7.1 →
  July 1), **The Skateway** (7.8 → the 7.8 km Rideau Canal Skateway),
  **The Great One** (9.9 → Gretzky's 99), **The Loonie** (flat 1.0),
  **The Toonie** (flat 2.0).
- `flavor_contains` `{text}` — wing flavor contains the text. Used for
  **The Honey Garlic Accord** (honey garlic).

Both are evaluated by a new `award_canadiana_badges()` function (following the
019 pattern of not touching `award_user_badges`), called from the existing
review trigger via `award_engagement_after_change`.

The rest reuse existing criteria: word/pattern badges (**Side of Poutine**,
**The Extra U** — Canadian spellings, **National Reflex** — said sorry,
**Tapped** — maple, **Rink Rat** — hockey/Sens, **Timmies Run**) via
`review_text_contains` with word-boundary regex patterns plus a new `hint`
config key surfaced in the detail modal; and Canadian-number counts
(**The Alfie** — 11 reviews for Alfredsson's number, **The Two-Four** — 24
reviews, **The Snowbirds** — 9 unique spots for the 9-jet formation,
**Snow Day** — 10 takeout orders). Each has a custom SVG in the BadgeIcon
registry.

## Testing

Unit test for `BadgeIcon` (SVG for known key, emoji fallback for unknown),
existing vitest suite, and `npm run build`.
