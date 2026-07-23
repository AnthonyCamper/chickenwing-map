# Photo Swipe Everywhere + Refresh Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instagram-feel photo swiping in every carousel (including photos opened from the map/list), and map camera + gallery scroll surviving a page refresh.

**Architecture:** A new `useDragCarousel` hook (finger-tracking translate + snap) replaces the threshold-only `useCarouselSwipe` in all three carousels. `usePhotoDetail` is reworked to fetch the whole review so PhotoModal always has the full photo set (opened at the tapped photo via a new `initialPhotoIndex` prop). Persistence is sessionStorage-based: map camera on `moveend`, gallery pagination depth after each page load.

**Tech Stack:** React 18 + TypeScript, Tailwind, Supabase JS, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-07-22-photo-swipe-and-refresh-persistence-design.md`

## Global Constraints

- Node: prefix every test/build command with `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`.
- Only `git add` the exact files named in each task's commit step. Never `git add -A`.
- Interactive non-submit `<button>` elements get explicit `type="button"`.
- sessionStorage reads/writes always wrapped in try/catch (ignore failures).
- Drag constants (single source of truth, in `useDragCarousel.ts`): axis lock after 6px; edge resistance 0.35; advance at 20% of container width or flick velocity > 0.3 px/ms; snap `transform 250ms cubic-bezier(0.22, 1, 0.36, 1)`, `none` while dragging.
- Storage keys: `wingmap-camera`, `gallery-depth:<feed>` where `<feed>` ∈ `following` | `discover` (must match existing `gallery-scroll:<feed>`).

---

### Task 1: `useDragCarousel` hook

**Files:**
- Create: `src/components/gallery/useDragCarousel.ts`
- Test: `src/components/gallery/useDragCarousel.test.tsx`

**Interfaces:**
- Consumes: nothing project-specific.
- Produces (used by Task 3): `useDragCarousel(count: number, index: number, onIndexChange: (i: number) => void): { containerProps: { onTouchStart; onTouchMove; onTouchEnd }, trackStyle: React.CSSProperties, dragging: boolean }`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/gallery/useDragCarousel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useDragCarousel } from './useDragCarousel'

function Harness({ count, index, onChange }: { count: number; index: number; onChange: (i: number) => void }) {
  const { containerProps, trackStyle, dragging } = useDragCarousel(count, index, onChange)
  return (
    <div data-testid="surface" data-dragging={dragging} {...containerProps}>
      <div data-testid="track" style={trackStyle} />
    </div>
  )
}

function touch(x: number, y: number) {
  return { clientX: x, clientY: y }
}

/** jsdom clientWidth is 0; the hook clamps width to >= 1, so distance-based
 *  advances trigger with any dx — velocity/axis behavior is what we assert. */
describe('useDragCarousel', () => {
  it('advances on a horizontal drag past the distance threshold', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    fireEvent.touchStart(s, { touches: [touch(200, 100)] })
    fireEvent.touchMove(s, { touches: [touch(120, 104)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(120, 104)] })
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('goes back on a rightward drag', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={1} onChange={onChange} />)
    const s = getByTestId('surface')
    fireEvent.touchStart(s, { touches: [touch(100, 100)] })
    fireEvent.touchMove(s, { touches: [touch(180, 96)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(180, 96)] })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it('ignores a vertical-dominant gesture', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    fireEvent.touchStart(s, { touches: [touch(100, 100)] })
    fireEvent.touchMove(s, { touches: [touch(110, 220)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(110, 220)] })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('never advances past the ends', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    // rightward drag at index 0 → rubber-band, no index change
    fireEvent.touchStart(s, { touches: [touch(100, 100)] })
    fireEvent.touchMove(s, { touches: [touch(220, 100)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(220, 100)] })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('is inert when count < 2', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={1} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    fireEvent.touchStart(s, { touches: [touch(200, 100)] })
    fireEvent.touchMove(s, { touches: [touch(80, 100)] })
    fireEvent.touchEnd(s, { changedTouches: [touch(80, 100)] })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('tracks the finger while dragging and snaps with a transition on release', () => {
    const onChange = vi.fn()
    const { getByTestId } = render(<Harness count={3} index={0} onChange={onChange} />)
    const s = getByTestId('surface')
    const track = getByTestId('track')
    fireEvent.touchStart(s, { touches: [touch(200, 100)] })
    fireEvent.touchMove(s, { touches: [touch(150, 100)] })
    expect(s.dataset.dragging).toBe('true')
    expect(track.style.transition).toBe('none')
    expect(track.style.transform).toContain('-50px')
    fireEvent.touchEnd(s, { changedTouches: [touch(150, 100)] })
    expect(s.dataset.dragging).toBe('false')
    expect(track.style.transition).toContain('250ms')
    expect(track.style.transform).toContain('+ 0px')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/components/gallery/useDragCarousel.test.tsx`
Expected: FAIL — cannot resolve `./useDragCarousel`.

- [ ] **Step 3: Write the implementation**

Create `src/components/gallery/useDragCarousel.ts`:

```tsx
import { useRef, useState } from 'react'

const AXIS_LOCK_PX = 6          // gesture axis decided after this much travel
const FLICK_VELOCITY = 0.3      // px/ms — a fast flick advances even on a short drag
const DISTANCE_FRACTION = 0.2   // dragging past 20% of the container width advances
const EDGE_RESISTANCE = 0.35    // rubber-band factor when dragging past the ends

/**
 * Instagram-style drag carousel: the track follows the finger (axis-locked so
 * vertical page scroll is never hijacked), rubber-bands at the ends, and on
 * release either advances (far drag or fast flick) or snaps back. Reduced
 * motion is handled by the global transition kill-switch in index.css, which
 * overrides the inline snap transition.
 */
export function useDragCarousel(count: number, index: number, onIndexChange: (i: number) => void) {
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const axis = useRef<'h' | 'v' | null>(null)
  const width = useRef(1)

  const onTouchStart = (e: React.TouchEvent) => {
    if (count < 2) return
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: e.timeStamp }
    axis.current = null
    width.current = Math.max(1, (e.currentTarget as HTMLElement).clientWidth)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return
    const dx = e.touches[0].clientX - start.current.x
    const dy = e.touches[0].clientY - start.current.y
    if (axis.current === null && (Math.abs(dx) > AXIS_LOCK_PX || Math.abs(dy) > AXIS_LOCK_PX)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (axis.current === 'h') setDragging(true)
    }
    if (axis.current !== 'h') return
    const pastStart = index === 0 && dx > 0
    const pastEnd = index === count - 1 && dx < 0
    setDragPx(pastStart || pastEnd ? dx * EDGE_RESISTANCE : dx)
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!start.current) return
    const dx = e.changedTouches[0].clientX - start.current.x
    const dt = Math.max(1, e.timeStamp - start.current.t)
    const horizontal = axis.current === 'h'
    start.current = null
    axis.current = null
    setDragging(false)
    setDragPx(0)
    if (!horizontal) return
    const flick = Math.abs(dx) / dt > FLICK_VELOCITY
    const far = Math.abs(dx) > width.current * DISTANCE_FRACTION
    if (!flick && !far) return
    if (dx < 0 && index < count - 1) onIndexChange(index + 1)
    else if (dx > 0 && index > 0) onIndexChange(index - 1)
  }

  return {
    containerProps: { onTouchStart, onTouchMove, onTouchEnd },
    trackStyle: {
      transform: `translateX(calc(-${index * 100}% + ${dragPx}px))`,
      transition: dragging ? 'none' : 'transform 250ms cubic-bezier(0.22, 1, 0.36, 1)',
    } as React.CSSProperties,
    dragging,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/components/gallery/useDragCarousel.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/gallery/useDragCarousel.ts src/components/gallery/useDragCarousel.test.tsx
git commit -m "feat: useDragCarousel — finger-tracking carousel hook"
```

---

### Task 2: Review-shaped `usePhotoDetail` + `initialPhotoIndex`

**Files:**
- Modify: `src/hooks/usePhotoDetail.ts` (full rewrite below)
- Modify: `src/components/gallery/PhotoModal.tsx` (add `initialPhotoIndex` to both prop interfaces; seed state)
- Modify: `src/components/MapView.tsx`, `src/components/ListView.tsx` (consumer prop change)
- Modify: `src/components/ListView.test.tsx` (hook mock shape, if it mocks usePhotoDetail — inspect and update accordingly)
- Test: `src/hooks/usePhotoDetail.test.ts`

**Interfaces:**
- Consumes: `GalleryPhoto`, `GalleryReviewItem` from `src/lib/types.ts`.
- Produces (used by Task 5 smoke): `usePhotoDetail(currentUserId)` returns `{ review: GalleryReviewItem | null, initialIndex: number, loading, open(photoId), close(), toggleLike(), onCommentAdded() }`. `PhotoModal` accepts optional `initialPhotoIndex?: number` on both prop variants.

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/usePhotoDetail.test.ts`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const single = vi.fn()
const order = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((col: string) => col === 'photo_id' ? { single } : { order }),
      })),
      insert: vi.fn(async () => ({ error: null })),
      delete: vi.fn(() => ({ match: vi.fn(async () => ({ error: null })) })),
    })),
  },
}))
vi.mock('../lib/pushManager', () => ({ triggerPushDelivery: vi.fn() }))

import { usePhotoDetail } from './usePhotoDetail'

function row(photo_id: string, display_order: number) {
  return {
    photo_id, display_order,
    photo_url: `https://x/${photo_id}.jpg`, photo_created_at: '2026-07-01',
    review_id: 'r1', overall_rating: 8, wing_flavor: null, wing_flavors: [],
    review_text: null, visited_at: '2026-07-01', wing_spot_id: 's1',
    spot_name: 'Spot', spot_slug: null, spot_address: 'Addr',
    reviewer_id: 'u2', reviewer_name: 'Ana', reviewer_username: 'ana',
    reviewer_avatar: null, reviewer_email: null, reviewer_is_private: false,
    like_count: 0, comment_count: 0, is_liked_by_me: false,
    event_id: null, event_slug: null, event_name: null,
  }
}

beforeEach(() => {
  single.mockReset()
  order.mockReset()
})

describe('usePhotoDetail', () => {
  it('opens the full review with photos ordered and initialIndex at the tapped photo', async () => {
    single.mockResolvedValue({ data: row('p2', 1), error: null })
    order.mockResolvedValue({ data: [row('p1', 0), row('p2', 1), row('p3', 2)], error: null })
    const { result } = renderHook(() => usePhotoDetail('u1'))
    await act(() => result.current.open('p2'))
    await waitFor(() => expect(result.current.review).not.toBeNull())
    expect(result.current.review!.photos.map(p => p.photo_id)).toEqual(['p1', 'p2', 'p3'])
    expect(result.current.initialIndex).toBe(1)
  })

  it('falls back to a single-photo review when the review query fails', async () => {
    single.mockResolvedValue({ data: row('p2', 1), error: null })
    order.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => usePhotoDetail('u1'))
    await act(() => result.current.open('p2'))
    await waitFor(() => expect(result.current.review).not.toBeNull())
    expect(result.current.review!.photos.map(p => p.photo_id)).toEqual(['p2'])
    expect(result.current.initialIndex).toBe(0)
  })

  it('clears state and reports nothing on first-query failure', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'nope' } })
    const { result } = renderHook(() => usePhotoDetail('u1'))
    await act(() => result.current.open('p9'))
    expect(result.current.review).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})
```

(If `react-hot-toast` noise appears, add `vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }))`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/hooks/usePhotoDetail.test.ts`
Expected: FAIL — hook still returns `photo`, not `review`.

- [ ] **Step 3: Rewrite `src/hooks/usePhotoDetail.ts`**

Replace the whole file with:

```tsx
import { useCallback, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { triggerPushDelivery } from '../lib/pushManager'
import type { GalleryPhoto, GalleryReviewItem } from '../lib/types'

function toReview(rows: GalleryPhoto[]): GalleryReviewItem {
  const first = rows[0]
  return {
    review_id: first.review_id,
    overall_rating: first.overall_rating,
    wing_flavor: first.wing_flavor,
    wing_flavors: first.wing_flavors,
    review_text: first.review_text,
    visited_at: first.visited_at,
    wing_spot_id: first.wing_spot_id,
    spot_name: first.spot_name,
    spot_slug: first.spot_slug,
    spot_address: first.spot_address,
    reviewer_id: first.reviewer_id,
    reviewer_name: first.reviewer_name,
    reviewer_username: first.reviewer_username,
    reviewer_avatar: first.reviewer_avatar,
    reviewer_email: first.reviewer_email,
    reviewer_is_private: first.reviewer_is_private,
    like_count: first.like_count,
    comment_count: first.comment_count,
    is_liked_by_me: first.is_liked_by_me,
    event_id: first.event_id,
    event_slug: first.event_slug,
    event_name: first.event_name,
    photos: rows.map(p => ({
      photo_id: p.photo_id,
      photo_url: p.photo_url,
      display_order: p.display_order,
      photo_created_at: p.photo_created_at,
    })),
  }
}

/**
 * Hook for opening a review's photos in PhotoModal from list/map views.
 * Fetches the tapped photo's whole review so the modal gets the full
 * swipeable carousel; falls back to just the tapped photo if the review
 * query fails. Likes operate at the review level.
 */
export function usePhotoDetail(currentUserId: string) {
  const [detail, setDetail] = useState<{ review: GalleryReviewItem; initialIndex: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const open = useCallback(async (photoId: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('gallery_feed')
      .select('*')
      .eq('photo_id', photoId)
      .single()
    if (error || !data) {
      toast.error('Could not load photo')
      setDetail(null)
      setLoading(false)
      return
    }
    const tapped = data as GalleryPhoto
    const { data: siblings, error: reviewError } = await supabase
      .from('gallery_feed')
      .select('*')
      .eq('review_id', tapped.review_id)
      .order('display_order', { ascending: true })
    const rows = (reviewError || !siblings || siblings.length === 0)
      ? [tapped]
      : (siblings as GalleryPhoto[])
    setDetail({
      review: toReview(rows),
      initialIndex: Math.max(0, rows.findIndex(p => p.photo_id === photoId)),
    })
    setLoading(false)
  }, [])

  const close = useCallback(() => setDetail(null), [])

  const toggleLike = useCallback(async () => {
    if (!detail) return
    const { review } = detail
    const wasLiked = review.is_liked_by_me
    setDetail(d => d ? {
      ...d,
      review: {
        ...d.review,
        is_liked_by_me: !wasLiked,
        like_count: wasLiked ? d.review.like_count - 1 : d.review.like_count + 1,
      },
    } : d)
    const { error } = wasLiked
      ? await supabase.from('review_likes').delete().match({ review_id: review.review_id, user_id: currentUserId })
      : await supabase.from('review_likes').insert({ review_id: review.review_id, user_id: currentUserId })

    if (error) {
      setDetail(d => d ? {
        ...d,
        review: { ...d.review, is_liked_by_me: wasLiked, like_count: review.like_count },
      } : d)
      toast.error('Could not update like')
    } else if (!wasLiked) {
      triggerPushDelivery()
    }
  }, [detail, currentUserId])

  const onCommentAdded = useCallback(() => {
    setDetail(d => d ? { ...d, review: { ...d.review, comment_count: d.review.comment_count + 1 } } : d)
  }, [])

  return {
    review: detail?.review ?? null,
    initialIndex: detail?.initialIndex ?? 0,
    loading,
    open,
    close,
    toggleLike,
    onCommentAdded,
  }
}
```

- [ ] **Step 4: Add `initialPhotoIndex` to PhotoModal**

In `src/components/gallery/PhotoModal.tsx`:
1. Add `initialPhotoIndex?: number` to BOTH `ReviewProps` and `PhotoProps` interfaces.
2. Change `const [photoIndex, setPhotoIndex] = useState(0)` to
   `const [photoIndex, setPhotoIndex] = useState(props.initialPhotoIndex ?? 0)`.

- [ ] **Step 5: Update consumers**

In `src/components/MapView.tsx`, the photo-detail modal render changes from
`photoDetail.photo && (<PhotoModal photo={photoDetail.photo} …`)` to:

```tsx
{photoDetail.review && (
  <PhotoModal
    review={photoDetail.review}
    initialPhotoIndex={photoDetail.initialIndex}
    currentUserId={currentUserId}
    isAdmin={isAdmin}
    onClose={photoDetail.close}
    onLike={photoDetail.toggleLike}
    onCommentAdded={photoDetail.onCommentAdded}
  />
)}
```

Apply the same `photo=`→`review=` + `initialPhotoIndex` change in `src/components/ListView.tsx` (find its `photoDetail.photo` usages — guard conditions AND the PhotoModal props). Update `src/components/ListView.test.tsx` if it stubs `usePhotoDetail` (return `{ review: null, initialIndex: 0, loading: false, open: vi.fn(), close: vi.fn(), toggleLike: vi.fn(), onCommentAdded: vi.fn() }`).

- [ ] **Step 6: Verify**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/hooks/usePhotoDetail.test.ts && npx tsc --noEmit && npm test`
Expected: new tests pass, tsc clean, full suite green.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/usePhotoDetail.ts src/hooks/usePhotoDetail.test.ts src/components/gallery/PhotoModal.tsx src/components/MapView.tsx src/components/ListView.tsx src/components/ListView.test.tsx
git commit -m "feat: open full review carousel from any photo tap"
```

---

### Task 3: Drag-carousel markup in all three carousels

**Files:**
- Modify: `src/components/gallery/PhotoModal.tsx` (mobile + desktop photo panes)
- Modify: `src/components/gallery/ReviewFeedCard.tsx`
- Modify: `src/components/gallery/ReviewCard.tsx`
- Delete: `src/components/gallery/useCarouselSwipe.ts`

**Interfaces:**
- Consumes: `useDragCarousel` from Task 1 (exact signature in Task 1's Produces).
- Produces: no API changes — internal markup only.

- [ ] **Step 1: Convert each carousel from a swapped `<img>` to a translated track**

For each component, replace the `useCarouselSwipe` import + `swipeHandlers` with:

```tsx
import { useDragCarousel } from './useDragCarousel'
// inside the component (photos = the review's photos array, photoIndex/setPhotoIndex = existing state):
const { containerProps, trackStyle } = useDragCarousel(photos.length, photoIndex, setPhotoIndex)
```

and replace the single current-photo `<img src={displayPhoto.photo_url} …>` with a track inside the existing `overflow-hidden` container (add `overflow-hidden` if the container lacks it). The container gets `{...(photos.length > 1 ? containerProps : {})}` (replacing the old swipeHandlers spread); the track:

```tsx
<div className="flex h-full w-full" style={photos.length > 1 ? trackStyle : undefined}>
  {photos.map(p => (
    <img
      key={p.photo_id}
      src={p.photo_url}
      alt=""
      loading="lazy"
      className="w-full h-full flex-shrink-0 object-cover"
      draggable={false}
    />
  ))}
</div>
```

Component notes:
- `gallery/ReviewCard.tsx` and `ReviewFeedCard.tsx`: single carousel each; keep every overlay (dots, badges, counts) exactly as-is — they position absolutely over the container and read the existing index state. Preserve any existing `onClick`/classes from the replaced `<img>` on the container or track as appropriate (an image-level onClick moves to the track imgs or container — keep behavior identical).
- `PhotoModal.tsx`: TWO panes use `carouselSwipeProps` (mobile `aspect-video` container and desktop `sm:w-[46%]` pane). Both switch to the same `containerProps`/`trackStyle` pattern with `reviewData.photos` and existing `photoIndex`/`setPhotoIndex`. The desktop pane centers the image (`object-contain` on black) — keep each img's current fit classes inside the track (use the classes the replaced `<img>` had, plus `w-full flex-shrink-0`). Delete `useCarouselSwipe` import, `goToPrev/goToNext` STAY (arrow buttons still use them).
- After all three are converted: `git rm src/components/gallery/useCarouselSwipe.ts` (grep first to confirm no remaining importers).

- [ ] **Step 2: Verify**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx tsc --noEmit && npm test`
Expected: tsc clean (catches any missed `useCarouselSwipe` importer), full suite green (existing card/modal tests must still pass — if a test asserted single-img markup, update it to query the track's first img instead, preserving the test's intent).

- [ ] **Step 3: Commit**

```bash
git add -u src/components/gallery
git commit -m "feat: finger-tracking drag carousels (Instagram-style swipe)"
```

---

### Task 4: Refresh persistence — map camera + gallery depth/scroll

**Files:**
- Modify: `src/components/MapView.tsx` (camera save/restore)
- Modify: `src/hooks/useGallery.ts` (depth save + cold-load ranged fetch)
- Modify: `src/components/gallery/GalleryView.tsx` (ungate cold-load scroll restore)
- Modify/extend: `src/hooks/useGallery.test.ts` (depth behavior)

**Interfaces:**
- Consumes: nothing new.
- Produces: sessionStorage contract — `wingmap-camera` = `{"lat":number,"lng":number,"zoom":number}`; `gallery-depth:<feed>` = stringified loaded-photo count.

- [ ] **Step 1: Map camera persistence (`MapView.tsx`)**

1. Above the component, add:

```tsx
const CAMERA_KEY = 'wingmap-camera'

function readSavedCamera(): { lat: number; lng: number; zoom: number } | null {
  try {
    const raw = sessionStorage.getItem(CAMERA_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    return typeof c?.lat === 'number' && typeof c?.lng === 'number' && typeof c?.zoom === 'number' ? c : null
  } catch {
    return null
  }
}
```

2. In the map-init effect, before deriving `initialCenter`, add `const savedCamera = readSavedCamera()`; when present it wins:

```tsx
if (savedCamera) {
  initialCenter = [savedCamera.lat, savedCamera.lng]
  initialZoom = savedCamera.zoom
} else if (/* existing shops-derived branch unchanged */) { … } else { /* world view */ }
```

3. Add a `restoredCameraRef = useRef(false)` set to `true` when `savedCamera` was used, and after map creation register:

```tsx
map.on('moveend', () => {
  const c = map.getCenter()
  try {
    sessionStorage.setItem(CAMERA_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }))
  } catch { /* ignore */ }
})
```

4. In the markers effect, wrap the trailing auto-fit block (`if (shopsWithReviews.length === 1) { … setView … } else { … fitBounds … }`) in `if (!restoredCameraRef.current) { … }` so a restored camera is never stomped. The `focusShopId` effect stays untouched.

- [ ] **Step 2: Gallery depth persistence (`useGallery.ts`)**

1. Add near `PAGE_SIZE`:

```tsx
function depthKey(followingOnly: boolean) {
  return `gallery-depth:${followingOnly ? 'following' : 'discover'}`
}

function readSavedDepth(followingOnly: boolean): number {
  try {
    const n = Number(sessionStorage.getItem(depthKey(followingOnly)) || 0)
    return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 0
  } catch {
    return 0
  }
}
```

(The 200 cap bounds the cold-load fetch to ~10 pages; deeper restores aren't worth the query cost.)

2. In the initial-load path (cold mount, no cache): fetch `.range(0, Math.max(PAGE_SIZE, readSavedDepth(followingOnly)) - 1)` instead of the first page's fixed range. Read the file to find the exact fetch call — initial load and `loadMore` may share a helper; only the cold initial load uses the saved depth, `loadMore` is unchanged.
3. After EVERY successful load (initial and loadMore), persist the new depth:

```tsx
try { sessionStorage.setItem(depthKey(followingOnly), String(offsetRef.current)) } catch { /* ignore */ }
```

(place it where `offsetRef.current` has just been advanced).

- [ ] **Step 3: Ungate cold-load scroll restore (`GalleryView.tsx`)**

In the restore effect (`GalleryView.tsx:63-76`): delete the `if (!gallery.restoredFromCache) return` line and its now-stale comment; the effect already waits for `!gallery.loading`, and with Task 4 Step 2 the cold-loaded list has its full height, so the saved offset no longer overshoots. Keep the double-rAF scroll. Update the header comment (lines 44-50) to describe the new behavior (restores on both back-nav and refresh; depth is re-fetched by useGallery). If `restoredFromCache` is now unused by ANY consumer, leave the hook's return field in place (other code may rely on it — check with grep; remove it from the hook only if nothing else uses it and note it in the report).

- [ ] **Step 4: Tests (`useGallery.test.ts`)**

Read the existing mock structure first and follow its patterns. Add two cases:
1. `sessionStorage['gallery-depth:discover'] = '42'` before a cold-mount render → the first fetch's `.range` call is `(0, 41)`.
2. After a successful initial load of N rows, `sessionStorage['gallery-depth:discover']` equals `String(N)`.
Clear sessionStorage in `beforeEach`.

- [ ] **Step 5: Verify**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/hooks/useGallery.test.ts && npx tsc --noEmit && npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/MapView.tsx src/hooks/useGallery.ts src/components/gallery/GalleryView.tsx src/hooks/useGallery.test.ts
git commit -m "feat: persist map camera + gallery depth/scroll across refresh"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Suite + build**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test && npm run build`
Expected: all tests pass; `✓ built`.

- [ ] **Step 2: Browser smoke (dev server + Playwright, pattern from the previous feature's scratchpad scripts)**

Verify:
- Map → tap a multi-photo fan → PhotoModal shows dots/arrows (carousel present, opens on tapped photo).
- Simulate a horizontal drag on the modal image (Playwright `touchscreen` or dispatched TouchEvents) → photo advances.
- On map view: pan/zoom somewhere distinctive → reload page → camera position survived.
- Gallery: scroll down past page 1 (trigger loadMore), reload → scroll position restored near where it was.

- [ ] **Step 3: Report**

Report results including screenshots taken; no commit.
