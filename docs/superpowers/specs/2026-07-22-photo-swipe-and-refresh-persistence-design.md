# Photo Swipe Everywhere + Refresh Persistence — Design

**Date:** 2026-07-22
**Status:** Approved by Anthony ("fix it all")

## Problems

1. **Tapping into a photo from the map panel or list gives a dead-end, single-photo
   modal.** `usePhotoDetail.open()` fetches ONE `gallery_feed` row and passes
   PhotoModal the `photo` prop; the modal wraps it in a one-photo array
   (`PhotoModal.tsx:76-81`), so every carousel affordance (swipe, arrows, dots) is
   hidden. The gallery path passes the whole review and works.
2. **Swiping doesn't feel like Instagram.** `useCarouselSwipe` is a
   touchstart/touchend threshold detector — the photo never follows the finger;
   it jumps after release.
3. **Refresh loses the user's place.** View + list filter survive (URL params),
   but: the map camera is recomputed and `fitBounds`-stomped on every mount;
   gallery scroll restore is deliberately skipped on cold loads
   (`GalleryView.tsx:66-69`) because only page 1 is fetched and a deep restore
   would overshoot.

## Design

### A. Full review carousel from every photo tap

- `usePhotoDetail` (`src/hooks/usePhotoDetail.ts`) becomes review-shaped:
  - `open(photoId)`: fetch the tapped row (`.eq('photo_id', id).single()`), then
    all rows for its review (`.eq('review_id', …).order('display_order')`),
    build a `GalleryReviewItem` (review fields from the first row + `photos[]`
    from all rows) and record `initialIndex` = position of the tapped photo.
    If the second query fails, fall back to a single-photo review (current
    behavior, never worse).
  - Hook returns `{ review, initialIndex, loading, open, close, toggleLike,
    onCommentAdded }`; like/comment mutators operate on the review object
    (likes are review-level already).
- `PhotoModal` gains optional `initialPhotoIndex?: number` on both prop
  variants; `photoIndex` state initializes from it (default 0).
- Consumers (`MapView.tsx`, `ListView.tsx`) switch from `photo={…}` to
  `review={…} initialPhotoIndex={…}`. The `PhotoProps` single-photo variant
  stays supported (type-level) but no longer has in-app callers.

### B. Instagram-feel drag carousel

- New hook `src/components/gallery/useDragCarousel.ts` replaces
  `useCarouselSwipe` (which is deleted):
  - `useDragCarousel(count, index, onIndexChange)` →
    `{ containerProps, trackStyle, dragging }`.
  - Finger tracking: on touchmove the track translates with the finger
    (axis-locked — a gesture that starts more vertical than horizontal is
    ignored so page scroll is never hijacked; lock decided after 6px).
  - Edge resistance: dragging past the first/last photo rubber-bands at 0.35×.
  - Release: advance when the drag passes 20% of container width OR flick
    velocity > 0.3 px/ms; otherwise snap back. Snap animation: `transform
    250ms cubic-bezier(0.22, 1, 0.36, 1)`; `transition: none` while dragging.
  - Reduced motion: the global `index.css` kill-switch
    (`transition-duration: 0.01ms !important`) overrides the inline
    transition, making snaps instant — no hook-level handling needed.
- Carousel markup changes from a single swapped `<img>` to a translated flex
  track rendering all of the review's photos
  (`overflow-hidden` container → `<div className="flex h-full"
  style={trackStyle}>` → one `w-full flex-shrink-0 object-cover` img per
  photo, `loading="lazy"`). Applied to all three carousels:
  `gallery/PhotoModal.tsx` (both mobile and desktop photo panes),
  `gallery/ReviewFeedCard.tsx`, `gallery/ReviewCard.tsx`. Dots/arrows/overlays
  keep their current markup and stay in sync via the existing `photoIndex`
  state.

### C. Refresh persistence

- **Map camera** (`MapView.tsx`): on `moveend`, write
  `{ lat, lng, zoom }` to `sessionStorage['wingmap-camera']`. On map init, a
  saved camera (parse failure → ignore) takes precedence over the
  shops-derived center, and suppresses the auto `fitBounds`/`setView` block in
  the markers effect for the whole mount (a `restoredCameraRef`). The
  "focus a shop from list/gallery" `setView` flow is unaffected.
- **Gallery depth + scroll** (`useGallery.ts`, `GalleryView.tsx`): after every
  successful page load, write the loaded-photo count to
  `sessionStorage['gallery-depth:<feed>']` (`following`/`discover`, matching
  the existing `gallery-scroll:<feed>` keys). On a cold mount (no module
  cache), the initial fetch ranges `0..max(PAGE_SIZE, savedDepth)-1` instead
  of one page, so the list regains its height; `GalleryView`'s scroll restore
  drops the `restoredFromCache` gate and restores whenever a saved offset
  exists once loading finishes.
- Storage failures (private mode) are try/caught and ignored everywhere.

## Error handling

- `usePhotoDetail`: first-query error keeps today's toast + null state; second
  query degrades to single-photo. No new failure modes elsewhere — persistence
  reads/writes are best-effort.

## Testing

- `useDragCarousel`: horizontal far-drag advances; fast flick advances on a
  short drag; vertical-dominant gesture never advances; edge drag (index 0,
  rightward) snaps back without calling `onIndexChange`; `count < 2` is inert.
- `usePhotoDetail`: builds review with all photos ordered by `display_order`
  and correct `initialIndex`; falls back to single photo when the review query
  errors; toggleLike updates review-level state.
- `useGallery`: cold mount with saved depth issues a ranged fetch to that
  depth; successful loads persist the new depth.
- Existing `ListView.test.tsx` mock updated to the review-shaped hook.
- Visual smoke: map fan tap → modal with dots + swipe; reload on map view →
  camera restored; gallery scroll + reload → position restored.

## Out of scope

- URL-addressable photo modal (deep links), pull-to-refresh, virtualized feed.
- `PhotoLightbox`'s own swipe handling (separate component, works today).
