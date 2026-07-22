# Map Panel & Review Card Rework — Design

**Date:** 2026-07-22
**Status:** Approved by Anthony (conversation), pending spec review

## Problem

1. The map spot panel's photo strip flattens every photo from every review into one
   row (`MapView.tsx` `PhotoStrip`), so a single review with many photos floods the
   strip and reviews aren't visually distinct.
2. `ReviewCard` puts the reviewer's avatar + name in the meta row at the *bottom*,
   after rating/flavor/text — you read the opinion before knowing whose it is. The
   gallery feed card already leads with identity; the rest of the app doesn't.
3. The map panel dumps the full review list the moment a pin is tapped, making the
   panel long and noisy for busy spots.

## Design

### 1. Photo strip → one fanned stack per review (map panel)

- New component `src/components/ui/ReviewPhotoFan.tsx`:
  - Props: `photos: ReviewPhoto[]` (that review's photos, ordered by
    `display_order`), `onOpen: () => void`, optional `size` (default 80px to match
    current strip thumbnails).
  - 1 photo → plain thumbnail button (visually identical to today's strip item).
  - 2+ photos → stacked "fan": front photo full-size, up to 2 photos peeking
    behind with slight rotation + offset, and a `×N` count badge in a corner.
  - Under `prefers-reduced-motion` / the app's reduced-motion handling: no
    rotation, plain offset stack only.
- `PhotoStrip` in `MapView.tsx` groups the spot's flattened `photos` by
  `review_id` (preserving newest-first review order, `display_order` within a
  review) and renders one `ReviewPhotoFan` per review.
- Tap behavior: opens the existing photo viewer (`onPhotoOpen(firstPhotoId)` →
  `usePhotoDetail` → `PhotoModal`), which already supports swiping through that
  review's photos. No inline fan-spread animation.
- Grouping is a pure helper `groupPhotosByReview(photos: ReviewPhoto[]):
  ReviewPhoto[][]` exported from `ReviewPhotoFan.tsx` for unit testing.

### 2. Reviewer identity moves to the top of `ReviewCard`

- New header row, first thing in the card: avatar + display name (linked to
  `/u/<username>` when public, "Private" handling unchanged) + visited date,
  with the 🍗 star rating + score on the same row (wrapping below on narrow
  widths is acceptable).
- The event badge (🏆) stays adjacent to the rating.
- The bottom meta row keeps: comment toggle, kebab (edit/delete) menu. The
  avatar/name/date leave the bottom row.
- Applies to both `compact` and full variants — this single component covers the
  map panel, `SpotPage`, and `ReviewPage`. Gallery cards
  (`gallery/ReviewFeedCard`, `gallery/ReviewCard`) already lead with identity
  and are not changed.

### 3. Map panel: reviews collapsed behind a toggle

- `ShopPanel` opens showing only: header (name, address, avg rating) + photo fan
  strip.
- Below the strip: full-width toggle button — `▾ Show N reviews` / `▴ Hide
  reviews` (N = review count; singular "review" when N = 1). Expanding reveals
  the existing `ReviewCard` list inline within the scrollable body.
- Collapsed is the default every time a spot is selected (state resets on spot
  change). Spots with zero reviews render no toggle and no list.

## Consistency rule

Anywhere the app summarizes *multiple reviews'* photos in one strip, it must be
one fan per review (today that's only the map panel). Pages that already display
photos per-review (`SpotPage`'s photo row inside each review block) are already
consistent and keep their current row layout. All non-gallery review displays go
through `ReviewCard`, so the identity-on-top change lands everywhere at once.

## Error handling

No new failure modes: grouping is pure/in-memory; photo viewer opening reuses the
existing `usePhotoDetail` loading/error path; toggle is local state.

## Testing

- `groupPhotosByReview`: preserves review order, orders within review by
  `display_order`, handles empty input.
- `ReviewPhotoFan`: renders plain thumbnail for 1 photo, stack + `×N` badge for
  many, fires `onOpen` on tap.
- `ShopPanel` toggle: reviews hidden by default, shown after tap, label flips,
  hidden again on collapse; no toggle when zero reviews.
- Update existing `ReviewCard.test.tsx` for the new header order (name/rating
  rendered before review text in the DOM).

## Out of scope

- Gallery feed/card layout changes.
- `ListView` (per-spot, not per-review, display).
- Any database or view changes.
