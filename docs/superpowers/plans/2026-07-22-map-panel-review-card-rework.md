# Map Panel & Review Card Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map panel shows one fanned photo stack per review with reviews collapsed behind a toggle, and every ReviewCard leads with reviewer identity + rating.

**Architecture:** A new `ReviewPhotoFan` UI component (with a pure `groupPhotosByReview` helper) replaces the flattened photo strip. `ShopPanel`/`PhotoStrip` move out of the 528-line `MapView.tsx` into their own file so the collapse toggle is testable. `ReviewCard`'s identity chip moves from the bottom meta row into a new top header row.

**Tech Stack:** React 18 + TypeScript, Tailwind, vitest + @testing-library/react (config in `vite.config.ts`, setup `src/test/setup.ts`).

**Spec:** `docs/superpowers/specs/2026-07-22-map-panel-review-card-rework-design.md`

## Global Constraints

- Node: the default shell Node (v20.11.0) breaks vitest. Prefix every test/build command with `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`.
- The working tree has a large unrelated uncommitted batch. **Only ever `git add` the exact files named in the task's commit step — never `git add -A` or `git add .`**
- Run tests with `npx vitest run <file>` for a single file, `npm test` for the suite.
- Reduced motion: use Tailwind's `motion-reduce:` variant (a global CSS kill-switch for animations already exists in `index.css`; static transforms need the variant).
- Copy/paste code exactly as shown; class names use the project palette (cream/night/charcoal/sauce/gold).

---

### Task 1: `ReviewPhotoFan` component + `groupPhotosByReview` helper

**Files:**
- Create: `src/components/ui/ReviewPhotoFan.tsx`
- Test: `src/components/ui/ReviewPhotoFan.test.tsx`

**Interfaces:**
- Consumes: `ReviewPhoto` from `src/lib/types.ts` (`{ id, review_id, storage_path, url, display_order, created_at }`).
- Produces (used by Task 3):
  - `groupPhotosByReview(photos: ReviewPhoto[]): ReviewPhoto[][]` (named export) — groups by `review_id`, preserves first-seen review order, sorts each group by `display_order` ascending.
  - `default ReviewPhotoFan({ photos, onOpen }: { photos: ReviewPhoto[]; onOpen: () => void })` — one strip item for one review's photos.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/ReviewPhotoFan.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ReviewPhotoFan, { groupPhotosByReview } from './ReviewPhotoFan'
import type { ReviewPhoto } from '../../lib/types'

function photo(id: string, review_id: string, display_order: number): ReviewPhoto {
  return {
    id,
    review_id,
    display_order,
    storage_path: `path/${id}.jpg`,
    url: `https://example.test/${id}.jpg`,
    created_at: '2026-07-01T00:00:00Z',
  }
}

describe('groupPhotosByReview', () => {
  it('returns an empty array for no photos', () => {
    expect(groupPhotosByReview([])).toEqual([])
  })

  it('groups by review_id preserving first-seen review order', () => {
    const groups = groupPhotosByReview([
      photo('a1', 'rA', 0),
      photo('b1', 'rB', 0),
      photo('a2', 'rA', 1),
    ])
    expect(groups.map(g => g[0].review_id)).toEqual(['rA', 'rB'])
    expect(groups[0].map(p => p.id)).toEqual(['a1', 'a2'])
    expect(groups[1].map(p => p.id)).toEqual(['b1'])
  })

  it('sorts photos within a review by display_order', () => {
    const groups = groupPhotosByReview([
      photo('a2', 'rA', 2),
      photo('a0', 'rA', 0),
      photo('a1', 'rA', 1),
    ])
    expect(groups[0].map(p => p.id)).toEqual(['a0', 'a1', 'a2'])
  })
})

describe('ReviewPhotoFan', () => {
  it('renders a single photo with no count badge', () => {
    // NB: <img alt=""> maps to the presentation role, so query the DOM directly.
    const { container } = render(<ReviewPhotoFan photos={[photo('a1', 'rA', 0)]} onOpen={vi.fn()} />)
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View photo' })).toBeInTheDocument()
  })

  it('renders a fan with ×N badge and at most 2 photos peeking behind', () => {
    const photos = [0, 1, 2, 3, 4].map(i => photo(`a${i}`, 'rA', i))
    const { container } = render(<ReviewPhotoFan photos={photos} onOpen={vi.fn()} />)
    // front + 2 behind, never more
    expect(container.querySelectorAll('img')).toHaveLength(3)
    expect(screen.getByText('×5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View 5 photos' })).toBeInTheDocument()
  })

  it('fires onOpen when tapped', () => {
    const onOpen = vi.fn()
    render(<ReviewPhotoFan photos={[photo('a1', 'rA', 0)]} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders nothing for an empty photo list', () => {
    const { container } = render(<ReviewPhotoFan photos={[]} onOpen={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/components/ui/ReviewPhotoFan.test.tsx`
Expected: FAIL — cannot resolve `./ReviewPhotoFan`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/ReviewPhotoFan.tsx`:

```tsx
import type { ReviewPhoto } from '../../lib/types'

/**
 * Groups a spot's flattened photo list into one array per review.
 * Review order follows first appearance in the input (the input is
 * newest-review-first); photos within a review sort by display_order.
 */
export function groupPhotosByReview(photos: ReviewPhoto[]): ReviewPhoto[][] {
  const groups = new Map<string, ReviewPhoto[]>()
  for (const p of photos) {
    const list = groups.get(p.review_id)
    if (list) list.push(p)
    else groups.set(p.review_id, [p])
  }
  return Array.from(groups.values(), list =>
    [...list].sort((a, b) => a.display_order - b.display_order)
  )
}

interface Props {
  /** One review's photos, any order (sorted here for safety). */
  photos: ReviewPhoto[]
  onOpen: () => void
}

/**
 * One photo-strip item representing a single review: a plain thumbnail for
 * one photo, a fanned stack with a ×N badge for several. Static transforms
 * only; rotation is dropped under reduced motion.
 */
export default function ReviewPhotoFan({ photos, onOpen }: Props) {
  if (photos.length === 0) return null
  const ordered = [...photos].sort((a, b) => a.display_order - b.display_order)
  const front = ordered[0]
  const behind = ordered.slice(1, 3)

  return (
    <button
      onClick={onOpen}
      aria-label={ordered.length > 1 ? `View ${ordered.length} photos` : 'View photo'}
      className="relative flex-shrink-0 w-20 h-20 rounded-xl focus:outline-none focus:ring-2 focus:ring-sauce-300"
    >
      {behind.map((p, i) => (
        <img
          key={p.id}
          src={p.url}
          alt=""
          aria-hidden
          loading="lazy"
          className={`absolute inset-0 w-full h-full object-cover rounded-xl border-2 border-night-900 bg-cream-200 ${
            i === 0
              ? 'rotate-[6deg] translate-x-[4px] motion-reduce:rotate-0'
              : '-rotate-[6deg] -translate-x-[4px] motion-reduce:rotate-0'
          }`}
        />
      ))}
      <img
        src={front.url}
        alt=""
        loading="lazy"
        className="relative w-full h-full object-cover rounded-xl border-2 border-night-900 bg-cream-200 hover:border-sauce-400 transition-colors"
      />
      {ordered.length > 1 && (
        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-night-900 text-cream-50 text-[10px] font-extrabold leading-none border border-cream-50">
          ×{ordered.length}
        </span>
      )}
    </button>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/components/ui/ReviewPhotoFan.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ReviewPhotoFan.tsx src/components/ui/ReviewPhotoFan.test.tsx
git commit -m "feat: ReviewPhotoFan — one fanned photo stack per review"
```

---

### Task 2: `ReviewCard` identity header

**Files:**
- Modify: `src/components/ReviewCard.tsx:143-252` (ratings row + meta row)
- Test: `src/components/ReviewCard.test.tsx` (append a describe block)

**Interfaces:**
- Consumes: nothing new.
- Produces: no API change — `ReviewCard` props are unchanged; only internal layout moves. Task 3's panel tests mock this component.

- [ ] **Step 1: Write the failing test**

Append to `src/components/ReviewCard.test.tsx` (after the existing `describe`; it reuses `makeReview`, so place it in the same file — note the existing `renderCard` helper is inside no describe and is reusable):

```tsx
describe('ReviewCard layout', () => {
  it('leads with reviewer identity, date, and rating above the review text', () => {
    const { container } = renderCard(vi.fn(async () => ({ error: null as string | null })))
    const html = container.innerHTML
    const name = html.indexOf('WingKingTony')
    const rating = html.indexOf('6.5')
    const date = html.indexOf('May 1, 2026')
    const text = html.indexOf('Hot and crispy')
    expect(name).toBeGreaterThan(-1)
    expect(name).toBeLessThan(text)
    expect(rating).toBeLessThan(text)
    expect(date).toBeLessThan(text)
  })

  it('keeps the comment toggle and options menu in the footer (after the text)', () => {
    renderCard(vi.fn(async () => ({ error: null as string | null })))
    expect(screen.getByLabelText(/comment/)).toBeInTheDocument()
    expect(screen.getByLabelText('Review options')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/components/ReviewCard.test.tsx`
Expected: the new layout test FAILS (`name` index is greater than `text` index — identity currently renders below the text). The two footer assertions and the three existing undo-delete tests PASS.

- [ ] **Step 3: Restructure the card**

In `src/components/ReviewCard.tsx`, replace the block from `{/* Ratings row */}` (line 143) through the end of the ratings row `</div>` (line 153) with:

```tsx
        {/* Identity + rating header */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {(() => {
            const isPrivate = review.reviewer_is_private === true
            const displayName = isPrivate ? 'Private' : (review.reviewer_name ?? review.reviewer_email ?? 'Unknown')
            const avatar = isPrivate ? null : review.reviewer_avatar
            const linkable = !isPrivate && review.reviewer_username
            const chip = (
              <>
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName}
                    className="w-6 h-6 rounded-full object-cover border border-night-900"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-night-800 text-cream-50 flex items-center justify-center text-[10px] font-extrabold uppercase border border-night-900">
                    {displayName.charAt(0)}
                  </span>
                )}
                <span className="text-[11px] font-extrabold uppercase tracking-crowd text-night-800">
                  {displayName}
                </span>
              </>
            )
            return linkable ? (
              <Link to={`/u/${review.reviewer_username}`} className="inline-flex items-center gap-2 hover:text-sauce-500 transition-colors">
                {chip}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2">{chip}</span>
            )
          })()}
          <span className="text-[11px] text-charcoal-500 font-medium">{visitedDate}</span>
          <span className="rating-wing ml-auto">
            🍗 <StarRating value={review.overall_rating} size="sm" /> {review.overall_rating.toFixed(1)}
          </span>
          {review.event_id && review.event_name && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-2 border-night-900 bg-gold-300 text-night-900 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm">
              🏆 {review.event_name}
            </span>
          )}
        </div>
```

Then replace the old meta row — everything from `{/* Meta */}` (line 168) down to and including the `<span className="text-charcoal-400">·</span>` that precedes the comment-toggle comment (line 204) — so the footer row becomes exactly:

```tsx
        {/* Footer: comments + options */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {/* Comment toggle — icon + count only, no text label */}
```

(The comment-toggle `<button>`, the `canEdit` kebab block, and the closing `</div>` of the row all stay exactly as they are.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/components/ReviewCard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Visually sanity-check both variants compile**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ReviewCard.tsx src/components/ReviewCard.test.tsx
git commit -m "feat: lead ReviewCard with reviewer identity + rating"
```

---

### Task 3: Extract `ShopPanel`, fan strip, collapsed reviews toggle

**Files:**
- Create: `src/components/ShopPanel.tsx` (moved out of MapView + new behavior)
- Test: `src/components/ShopPanel.test.tsx`
- Modify: `src/components/MapView.tsx` (delete local `ShopPanel`/`PhotoStrip`, import the new file, key the panel by spot id, trim imports)

**Interfaces:**
- Consumes: `ReviewPhotoFan` + `groupPhotosByReview` from Task 1 (exact signatures in Task 1's Produces block); `ReviewCard` (unchanged props: `review, currentUserId, isAdmin, onUpdate, onDelete, compact`).
- Produces: `default ShopPanel(props: ShopPanelProps)` where `ShopPanelProps` is identical to the interface currently at `MapView.tsx:411-419` (`spotData, onClose, currentUserId, isAdmin, onUpdate, onDelete, onPhotoOpen`).

- [ ] **Step 1: Write the failing tests**

Create `src/components/ShopPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ShopPanel from './ShopPanel'
import type { SpotWithReviews, Review, ReviewPhoto } from '../lib/types'

vi.mock('./ReviewCard', () => ({
  default: ({ review }: { review: Review }) => <div data-testid="review-card">{review.id}</div>,
}))

function photo(id: string, review_id: string, display_order: number): ReviewPhoto {
  return {
    id,
    review_id,
    display_order,
    storage_path: `path/${id}.jpg`,
    url: `https://example.test/${id}.jpg`,
    created_at: '2026-07-01T00:00:00Z',
  }
}

function makeSpotData(reviewIds: string[], photos: ReviewPhoto[]): SpotWithReviews {
  return {
    spot: { id: 'spot1', name: 'Wing Palace', address: '123 Main St' },
    reviews: reviewIds.map(id => ({ id })),
    avg_rating: 8.2,
    photos,
  } as unknown as SpotWithReviews
}

function renderPanel(spotData: SpotWithReviews, onPhotoOpen = vi.fn()) {
  render(
    <ShopPanel
      spotData={spotData}
      onClose={vi.fn()}
      currentUserId="u1"
      isAdmin={false}
      onUpdate={vi.fn(async () => ({ error: null as string | null }))}
      onDelete={vi.fn(async () => ({ error: null as string | null }))}
      onPhotoOpen={onPhotoOpen}
    />
  )
  return { onPhotoOpen }
}

describe('ShopPanel photo strip', () => {
  it('renders one fan per review, not one thumbnail per photo', () => {
    renderPanel(makeSpotData(['rA', 'rB'], [
      photo('a1', 'rA', 0), photo('a2', 'rA', 1), photo('a3', 'rA', 2),
      photo('b1', 'rB', 0),
    ]))
    expect(screen.getByRole('button', { name: 'View 3 photos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View photo' })).toBeInTheDocument()
    expect(screen.getByText('×3')).toBeInTheDocument()
  })

  it('opens the viewer at the first photo of the tapped review', () => {
    const { onPhotoOpen } = renderPanel(makeSpotData(['rA', 'rB'], [
      photo('a2', 'rA', 1), photo('a1', 'rA', 0),
      photo('b1', 'rB', 0),
    ]))
    fireEvent.click(screen.getByRole('button', { name: 'View 2 photos' }))
    expect(onPhotoOpen).toHaveBeenCalledWith('a1')
  })
})

describe('ShopPanel review collapse', () => {
  it('hides reviews by default behind a Show button', () => {
    renderPanel(makeSpotData(['rA', 'rB'], []))
    expect(screen.queryAllByTestId('review-card')).toHaveLength(0)
    expect(screen.getByRole('button', { name: /Show 2 reviews/ })).toBeInTheDocument()
  })

  it('expands and collapses on toggle, flipping the label', () => {
    renderPanel(makeSpotData(['rA', 'rB'], []))
    fireEvent.click(screen.getByRole('button', { name: /Show 2 reviews/ }))
    expect(screen.getAllByTestId('review-card')).toHaveLength(2)
    const hide = screen.getByRole('button', { name: /Hide reviews/ })
    fireEvent.click(hide)
    expect(screen.queryAllByTestId('review-card')).toHaveLength(0)
  })

  it('uses singular label for one review', () => {
    renderPanel(makeSpotData(['rA'], []))
    expect(screen.getByRole('button', { name: /Show 1 review$/ })).toBeInTheDocument()
  })

  it('renders no toggle when the spot has no reviews', () => {
    renderPanel(makeSpotData([], []))
    expect(screen.queryByRole('button', { name: /Show/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/components/ShopPanel.test.tsx`
Expected: FAIL — cannot resolve `./ShopPanel`.

- [ ] **Step 3: Create `ShopPanel.tsx`**

Create `src/components/ShopPanel.tsx`. This is the `ShopPanel` + `PhotoStrip` code currently at `MapView.tsx:411-527`, with three changes: (a) `PhotoStrip` renders `ReviewPhotoFan` groups and loses its dead `Lightbox` state, (b) reviews sit behind a toggle, (c) both get proper imports/exports.

```tsx
import { useState } from 'react'
import StarRating from './ui/StarRating'
import ReviewCard from './ReviewCard'
import ReviewPhotoFan, { groupPhotosByReview } from './ui/ReviewPhotoFan'
import type { SpotWithReviews, Review, ReviewPhoto, ReviewUpdateData } from '../lib/types'

interface ShopPanelProps {
  spotData: SpotWithReviews
  onClose: () => void
  currentUserId: string
  isAdmin: boolean
  onUpdate: (id: string, data: ReviewUpdateData) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  onPhotoOpen: (photoId: string) => void
}

export default function ShopPanel({ spotData, onClose, currentUserId, isAdmin, onUpdate, onDelete, onPhotoOpen }: ShopPanelProps) {
  const { spot, reviews, avg_rating, photos } = spotData
  // Collapsed on every open; MapView keys this component by spot id so
  // selecting another spot resets it.
  const [showReviews, setShowReviews] = useState(false)

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="absolute inset-0 z-20 sm:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-30 sm:left-auto sm:top-4 sm:right-4 sm:bottom-auto sm:w-80 bg-cream-50 rounded-t-3xl sm:rounded-3xl sm:border-2 sm:border-night-900 shadow-elevated animate-slide-up max-h-[72dvh] sm:max-h-[calc(100dvh-120px)] flex flex-col">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-night-900/25" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-night-900/10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display uppercase tracking-wide text-base text-night-900 leading-snug truncate">
              {spot.name}
            </h3>
            <p className="text-xs text-charcoal-500 mt-0.5 truncate">{spot.address}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {reviews.length > 1 && (
                <span className="text-xs text-charcoal-400">avg of {reviews.length}</span>
              )}
              <span className="rating-wing">
                🍗 <StarRating value={avg_rating} size="sm" />
                <span className="ml-0.5">{avg_rating.toFixed(1)}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-charcoal-500 hover:bg-cream-100 hover:text-night-900 transition-colors text-2xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="overflow-y-auto flex-1 overscroll-contain"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Photo strip — one fan per review */}
          {photos.length > 0 && (
            <div className="px-5 pt-4 pb-2">
              <PhotoStrip photos={photos} onPhotoOpen={onPhotoOpen} />
            </div>
          )}

          {/* Reviews — collapsed behind a toggle */}
          {reviews.length > 0 && (
            <div className="px-5 pb-5">
              <button
                onClick={() => setShowReviews(v => !v)}
                aria-expanded={showReviews}
                className="w-full mt-2 py-2.5 rounded-xl border-2 border-night-900 bg-cream-100 hover:bg-cream-200 transition-colors text-xs font-extrabold uppercase tracking-crowd text-night-900"
              >
                {showReviews
                  ? '▴ Hide reviews'
                  : `▾ Show ${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
              </button>
              {showReviews && (
                <div className="divide-y divide-night-900/10">
                  {reviews.map((review: Review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      compact
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

interface PhotoStripProps {
  photos: ReviewPhoto[]
  onPhotoOpen: (photoId: string) => void
}

function PhotoStrip({ photos, onPhotoOpen }: PhotoStripProps) {
  const groups = groupPhotosByReview(photos)
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {groups.map(group => (
        <ReviewPhotoFan
          key={group[0].id}
          photos={group}
          onOpen={() => onPhotoOpen(group[0].id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run the new tests**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx vitest run src/components/ShopPanel.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Wire MapView to the extracted panel**

In `src/components/MapView.tsx`:

1. Replace the import block lines
   ```tsx
   import StarRating from './ui/StarRating'
   import ReviewCard from './ReviewCard'
   import PhotoModal from './gallery/PhotoModal'
   import { Lightbox } from './ui/PhotoGallery'
   import { usePhotoDetail } from '../hooks/usePhotoDetail'
   import type { SpotWithReviews, Review, ReviewPhoto, ReviewUpdateData } from '../lib/types'
   ```
   with
   ```tsx
   import PhotoModal from './gallery/PhotoModal'
   import ShopPanel from './ShopPanel'
   import { usePhotoDetail } from '../hooks/usePhotoDetail'
   import type { SpotWithReviews, ReviewUpdateData } from '../lib/types'
   ```
   (`StarRating`, `ReviewCard`, `Lightbox`, `Review`, `ReviewPhoto` were only used by the moved code.)
2. Add a `key` so the collapse state resets per spot — change
   ```tsx
   {selectedSpot && (
     <ShopPanel
       spotData={selectedSpot}
   ```
   to
   ```tsx
   {selectedSpot && (
     <ShopPanel
       key={selectedSpot.spot.id}
       spotData={selectedSpot}
   ```
3. Delete everything from `interface ShopPanelProps {` (line 411) to the end of the old `PhotoStrip` function (end of file section at line ~527, including its closing brace) — the local `ShopPanel`, `PhotoStrip`, their prop interfaces, and the dead `Lightbox` usage all now live in/are replaced by `ShopPanel.tsx`.

- [ ] **Step 6: Type-check and run the full suite**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npx tsc --noEmit && npm test`
Expected: tsc clean; all test files pass (12 existing + 2 new).

- [ ] **Step 7: Commit**

```bash
git add src/components/ShopPanel.tsx src/components/ShopPanel.test.tsx src/components/MapView.tsx
git commit -m "feat: map panel — per-review photo fans + collapsed reviews toggle"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full suite + production build**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm test && npm run build`
Expected: all tests pass; `vite build` completes with `✓ built`.

- [ ] **Step 2: Visual smoke-check in the dev server**

Run: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" && npm run dev`
Then verify in the browser (or via the `run` skill):
- Map pin tap → panel shows fans (multi-photo review shows stacked look + ×N).
- Tapping a fan opens the photo viewer at that review's first photo; swipe moves through only that review's photos.
- "▾ Show N reviews" expands; reopening the panel or picking another spot starts collapsed.
- Review cards on the panel, spot page, and review page all lead with avatar + name + rating.

- [ ] **Step 3: Report**

No commit. Report results (including anything visually off) back for review before any further polish.
