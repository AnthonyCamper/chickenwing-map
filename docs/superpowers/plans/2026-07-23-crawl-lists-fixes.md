# Crawl / Lists Usability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every bug and design defect found in the 2026-07-23 usability review of the wing-crawl/lists feature (editor work-loss, spot-overwrite, slug collision, RLS gaps, missing on-crawl mode, naming confusion, feed/card affordances).

**Architecture:** Two DB migrations (slug reservation; crawl_likes RLS + grants + FK indexes) applied via the supabase-wing MCP. Frontend: CrawlEditor moves to debounced autosave with a single save-state indicator (kills the split persistence model and both work-loss bugs); new-list drafts persist to sessionStorage; CrawlPage gains an on-crawl mode (directions links + localStorage check-offs via a new `crawlUtils` module); route map always draws the polyline; naming and card affordances are unified.

**Tech Stack:** React 18 + TS + Vite, react-router-dom v6 (BrowserRouter — `useBlocker` NOT available), Supabase JS, Leaflet, vitest + jsdom (`src/test/setup.ts`), Tailwind.

## Global Constraints

- Node: use nvm Node 22 — `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"` before any npm/vitest/tsc command (default Node 20.11.0 breaks vitest).
- DB: production project (nzovofzjqjvxbzvelhyd, MCP server `supabase-wing`). Migrations must be additive/reversible; no data writes outside migrations; live verification only inside `BEGIN; … ROLLBACK;`.
- User-facing vocabulary: `wing_crawls` = **"List"** everywhere; `/events` feature = **"Events"** in navigation/index copy (in-page "Join the Crawl" flavor copy stays).
- No `useBlocker`/data-router APIs. No new dependencies.
- Auth comes from `useAuthContext()` (`src/components/AuthProvider.tsx`) — status: 'loading' | 'unauthenticated' | 'pending' | 'rejected' | 'disabled' | 'authorized', plus `isAdmin`, `user`, `profile`.
- Post-auth return path convention: `sessionStorage['auth-return-to']` (set before redirecting to login; consumed once in App.tsx when status becomes 'authorized'; must start with `/` and not `//`).
- Commit after each task with a conventional message ending in the Claude Fable co-author trailer.

---

### Task 1: Migration — reserved crawl slugs

**Files:**
- Migration via `mcp__supabase-wing__apply_migration`, name `reserve_crawl_slugs`

**Interfaces:**
- Produces: `set_crawl_slug()` trigger fn that never emits slugs `new` or `edit` (and suffixes them instead), for both generated and client-supplied slugs.

- [ ] **Step 1: Fetch current function** — `execute_sql`: `SELECT prosrc FROM pg_proc WHERE proname='set_crawl_slug'` (already dumped in review; re-confirm shape).
- [ ] **Step 2: Apply migration**

```sql
CREATE OR REPLACE FUNCTION public.set_crawl_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 1;
  reserved text[] := ARRAY['new', 'edit'];
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := slugify(NEW.title);
  ELSE
    base := slugify(NEW.slug);  -- normalize client-supplied slugs too
  END IF;
  IF base IS NULL OR base = '' THEN base := 'list'; END IF;
  candidate := base;
  LOOP
    EXIT WHEN NOT (candidate = ANY(reserved))
      AND NOT EXISTS (SELECT 1 FROM wing_crawls WHERE slug = candidate AND id IS DISTINCT FROM NEW.id);
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;
  NEW.slug := candidate;
  RETURN NEW;
END $$;
```

- [ ] **Step 3: Verify inside a rolled-back transaction** — `execute_sql`:

```sql
BEGIN;
INSERT INTO wing_crawls (user_id, title)
SELECT id, 'New' FROM profiles LIMIT 1
RETURNING slug;   -- expect 'new-2'
ROLLBACK;
```

Expected: returned slug is `new-2` (not `new`). ROLLBACK leaves no row.

### Task 2: Migration — crawl_likes RLS, badge RPC grant, FK indexes

**Files:**
- Migration via `apply_migration`, name `tighten_crawl_likes_and_grants`

- [ ] **Step 1: Apply migration**

```sql
-- Likes must reference a crawl the liker can see
DROP POLICY IF EXISTS "Crawl likes: approved users can like" ON public.crawl_likes;
CREATE POLICY "Crawl likes: approved users can like visible crawls"
  ON public.crawl_likes FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND is_approved()
    AND EXISTS (SELECT 1 FROM wing_crawls c
                WHERE c.id = crawl_id AND (c.is_public OR c.user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Crawl likes: anyone can read" ON public.crawl_likes;
CREATE POLICY "Crawl likes: readable on visible crawls"
  ON public.crawl_likes FOR SELECT
  USING (EXISTS (SELECT 1 FROM wing_crawls c
                 WHERE c.id = crawl_id AND (c.is_public OR c.user_id = auth.uid())));

-- Anon-executable SECURITY DEFINER RPC
REVOKE EXECUTE ON FUNCTION public.award_crawl_funny_badges(uuid) FROM anon, authenticated;

-- Advisor: unindexed FKs on crawl tables
CREATE INDEX IF NOT EXISTS crawl_likes_user_idx ON public.crawl_likes (user_id);
CREATE INDEX IF NOT EXISTS crawl_comments_user_idx ON public.crawl_comments (user_id);
CREATE INDEX IF NOT EXISTS crawl_comment_likes_user_idx ON public.crawl_comment_likes (user_id);
CREATE INDEX IF NOT EXISTS crawl_comment_reactions_user_idx ON public.crawl_comment_reactions (user_id);
CREATE INDEX IF NOT EXISTS wing_crawl_items_spot_idx ON public.wing_crawl_items (wing_spot_id);
```

Note: confirm actual current policy names first via `SELECT policyname FROM pg_policies WHERE tablename='crawl_likes'` and drop those exact names.

- [ ] **Step 2: Verify** — `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='crawl_likes'`; `SELECT has_function_privilege('anon', 'public.award_crawl_funny_badges(uuid)', 'EXECUTE')` → expect false. Confirm `wing_crawls_detailed.like_count`/`is_liked_by_me` still behave for a public crawl (SELECT from the view as-is).

### Task 3: crawlUtils helpers + tests (TDD)

**Files:**
- Create: `src/lib/crawlUtils.ts`
- Test: `src/lib/crawlUtils.test.ts`

**Interfaces (produces):**
```ts
export function directionsUrl(lat: number, lng: number): string
export function loadCrawlCheckoffs(crawlId: string): Set<string>
export function saveCrawlCheckoffs(crawlId: string, ids: Set<string>): void
```

- [ ] **Step 1: Write failing tests** (`src/lib/crawlUtils.test.ts`)

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { directionsUrl, loadCrawlCheckoffs, saveCrawlCheckoffs } from './crawlUtils'

describe('directionsUrl', () => {
  it('builds a google maps destination url', () => {
    expect(directionsUrl(38.9, -77.03)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=38.9%2C-77.03'
    )
  })
})

describe('crawl checkoffs', () => {
  beforeEach(() => localStorage.clear())
  it('round-trips a set of ids', () => {
    saveCrawlCheckoffs('c1', new Set(['a', 'b']))
    expect(loadCrawlCheckoffs('c1')).toEqual(new Set(['a', 'b']))
  })
  it('is scoped per crawl', () => {
    saveCrawlCheckoffs('c1', new Set(['a']))
    expect(loadCrawlCheckoffs('c2')).toEqual(new Set())
  })
  it('survives corrupt storage', () => {
    localStorage.setItem('crawl-checkoff:c1', '{not json')
    expect(loadCrawlCheckoffs('c1')).toEqual(new Set())
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/crawlUtils.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement**

```ts
const KEY = (crawlId: string) => `crawl-checkoff:${crawlId}`

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`
}

export function loadCrawlCheckoffs(crawlId: string): Set<string> {
  try {
    const raw = localStorage.getItem(KEY(crawlId))
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveCrawlCheckoffs(crawlId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(KEY(crawlId), JSON.stringify([...ids]))
  } catch { /* storage full/blocked — check-offs are best-effort */ }
}
```

- [ ] **Step 4: Run tests** → PASS. **Step 5: Commit** `feat: crawl on-crawl helpers (directions + checkoffs)`.

### Task 4: CrawlEditor — autosave, draft persistence, auth gate, race fixes

**Files:**
- Modify: `src/pages/CrawlEditor.tsx` (large rework of meta handling; item handlers)

Key changes (complete code for each in-place):

- [ ] **Step 1: Auth via context + return path.** Replace the getSession effect (lines 61-73) with:

```ts
const auth = useAuthContext()
const authChecked = !!auth && auth.status !== 'loading'
const authed = auth?.status === 'authorized'
const userId = auth?.user?.id ?? ''

useEffect(() => {
  if (!auth || auth.status === 'loading') return
  if (auth.status === 'unauthenticated') {
    sessionStorage.setItem('auth-return-to', window.location.pathname)
    navigate('/login', { replace: true })
  } else if (auth.status !== 'authorized') {
    toast.error('Your account needs approval before you can make lists')
    navigate('/', { replace: true })
  }
}, [auth, auth?.status, navigate])
```

Remove `authChecked/authed/userId` useState lines. Import `useAuthContext`.

- [ ] **Step 2: New-mode draft persistence.** On mount (isNew): hydrate from `sessionStorage['crawl-draft-new']`; on any meta change (isNew) write `{title, description, isPublic, isRanked}` to it; clear it on successful create.

```ts
const DRAFT_KEY = 'crawl-draft-new'
useEffect(() => {
  if (!isNew) return
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const d = JSON.parse(raw)
    if (typeof d.title === 'string') setTitle(d.title)
    if (typeof d.description === 'string') setDescription(d.description)
    if (typeof d.isPublic === 'boolean') setIsPublic(d.isPublic)
    if (typeof d.isRanked === 'boolean') setIsRanked(d.isRanked)
  } catch { /* corrupt draft — start fresh */ }
}, [isNew])
useEffect(() => {
  if (!isNew) return
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, isPublic, isRanked })) } catch { /* ignore */ }
}, [isNew, title, description, isPublic, isRanked])
```

In create success path: `sessionStorage.removeItem(DRAFT_KEY)` before navigating. Also arm `beforeunload` in new mode when `title.trim() || description.trim()`.

- [ ] **Step 3: Debounced autosave (edit mode) replaces Save/Discard.**

```ts
const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
const saveSeqRef = useRef(0)

const metaDirty = !!crawl && (
  title !== crawl.title
  || description !== (crawl.description ?? '')
  || isRanked !== crawl.is_ranked
  || isPublic !== crawl.is_public
)

useEffect(() => {
  if (!crawl || !metaDirty) return
  if (!title.trim()) { setSaveState('error'); return }
  setSaveState('saving')
  const t = window.setTimeout(async () => {
    const seq = ++saveSeqRef.current
    const payload = { title, description, is_public: isPublic, is_ranked: isRanked }
    const result = await updateCrawl(crawl.id, payload)
    if (seq !== saveSeqRef.current) return  // superseded by a newer save
    if (result.error) { setSaveState('error'); toast.error(result.error); return }
    setCrawl(c => c ? {
      ...c,
      title: payload.title.trim(),
      description: payload.description.trim() || null,
      is_public: payload.is_public,
      is_ranked: payload.is_ranked,
    } : c)
    setSaveState('saved')
  }, 800)
  return () => window.clearTimeout(t)
}, [crawl, metaDirty, title, description, isPublic, isRanked])
```

`beforeunload` now arms when `metaDirty || saveState === 'saving'` (edit) — keep existing effect but update its condition. Delete `handleDiscardMeta`, the sticky save bar JSX (lines 484-509), and the edit branch of `handleSaveMeta`; keep a `handleCreate` for the isNew branch only (button label "Create list"). Header chip replaced by save indicator:

```tsx
{!isNew && saveState !== 'idle' && (
  <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-night-900 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm ${
    saveState === 'error' ? 'bg-sauce-100 text-sauce-700' : 'bg-gold-300 text-night-900'
  }`}>
    {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? (title.trim() ? 'Save failed' : 'Title required') : 'Saved'}
  </span>
)}
```

- [ ] **Step 4: New-mode placeholder for phase two.** After the details card, when `isNew`:

```tsx
{isNew && (
  <div className="card px-5 py-5 opacity-70">
    <h2 className="font-display text-lg text-charcoal-800 mb-1">Spots, cover & notes</h2>
    <p className="text-sm text-charcoal-500">
      Create the list first — then you add spots, a cover image, and per-spot notes right here.
    </p>
  </div>
)}
```

- [ ] **Step 5: Race fixes.**
  - `handleAddSpot`: guard with `addingRef = useRef(new Set<string>())`; add/delete around the awaits; keep the `items.some` check.
  - `handleRemoveItem`: functional `setItems(prev => prev.filter(...))`; on error `toast.error(error); await load()` (drop the snapshot restore).
  - `handleSaveNote`: `setItems(prev => prev.map(...))`.
  - `load()`: capture `error: itemsErr` from the items query; if `itemsErr`, `toast.error('Could not load spots'); setLoading(false); return` (leave page usable, don't render fake-empty — render a retry hint by keeping `items` as `[]` but showing toast is acceptable v1).
- [ ] **Step 6: Spot upsert → insert-or-reuse.** In `AddSpotForm.handleCreateAndAdd` replace the upsert with:

```ts
const { data: spot, error } = await supabase
  .from('wing_spots')
  .insert({ name: newName.trim(), address: newAddr.trim(), lat, lng })
  .select('id')
  .single()
let spotId = spot?.id as string | undefined
if (error) {
  if (error.code === '23505') {
    // Spot already exists — reuse it, never overwrite its data.
    const { data: existing } = await supabase
      .from('wing_spots')
      .select('id')
      .eq('name', newName.trim())
      .eq('address', newAddr.trim())
      .maybeSingle()
    spotId = existing?.id
  }
  if (!spotId) { setCreating(false); toast.error(error.message ?? 'Could not add spot'); return }
}
```

- [ ] **Step 7: Delete destination.** `handleDeleteCrawl` → navigate to `/u/${auth?.profile?.username}` when username exists, else `/`.
- [ ] **Step 8: Touch/contrast smalls.** "+ Add a note" button: add `min-h-[44px] py-2 -my-1`; char counter `text-charcoal-400` → `text-charcoal-500`.
- [ ] **Step 9:** `npm run build` passes. Commit `fix: crawl editor autosave, draft persistence, race + auth fixes`.

### Task 5: Post-auth return-to plumbing

**Files:**
- Modify: `src/App.tsx`, `src/components/AuthGateModal.tsx`

- [ ] **Step 1: App.tsx** — inside `App()` add:

```ts
useEffect(() => {
  if (auth.status !== 'authorized') return
  const dest = sessionStorage.getItem('auth-return-to')
  if (!dest) return
  sessionStorage.removeItem('auth-return-to')
  if (dest.startsWith('/') && !dest.startsWith('//')) navigate(dest, { replace: true })
}, [auth.status, navigate])
```

(import `useEffect`.)

- [ ] **Step 2: AuthGateModal** — before each navigation/OAuth kick-off, remember where the user was:

```ts
function rememberHere() {
  try { sessionStorage.setItem('auth-return-to', window.location.pathname + window.location.search) } catch { /* ignore */ }
}
```

Call `rememberHere()` in the onClick handlers for "Create an account", "Sign in", and wrap `onSignInGoogle` (`onClick={() => { rememberHere(); onSignInGoogle() }}`).

- [ ] **Step 3:** Build passes. Commit `feat: return users to where they were after sign-in`.

### Task 6: CrawlOwnerToolbar sticks below the header

**Files:**
- Modify: `src/components/ui/CrawlOwnerToolbar.tsx:33`

- [ ] **Step 1:** Change the wrapper to stick below the 58px header (AppHeader: py-2.5 + h-9 content + 2px border):

```tsx
<div
  className="sticky z-30 border-b-2 border-night-900/10 bg-cream-100/95 backdrop-blur supports-[backdrop-filter]:bg-cream-100/80"
  style={{ top: 'calc(env(safe-area-inset-top) + 58px)' }}
>
```

- [ ] **Step 2:** Focus restore on cancel: `onClick={() => { setConfirming(false); deleteTriggerRef.current?.focus() }}` with `const deleteTriggerRef = useRef<HTMLButtonElement>(null)` on the Delete button. Commit `fix: owner toolbar no longer hides under app header`.

### Task 7: CrawlRouteMap — always draw route, tame mobile gestures

**Files:**
- Modify: `src/components/ui/CrawlRouteMap.tsx`; callers `src/pages/CrawlPage.tsx`, `src/pages/CrawlEditor.tsx`

- [ ] **Step 1:** Remove the `ranked` prop entirely (Props, destructure, effect dep, callers). Polyline draws whenever `latlngs.length > 1`.
- [ ] **Step 2:** Map init options → `{ zoomControl: true, attributionControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile }` (pan via two-finger zoom + zoom buttons on mobile; page scroll no longer trapped).
- [ ] **Step 3:** Container div gets `role="region" aria-label="Crawl route map"`.
- [ ] **Step 4:** Build passes. Commit `fix: route line for unranked lists + mobile scroll not trapped by map`.

### Task 8: CrawlPage — on-crawl mode, admin, private share, dead links, numbering

**Files:**
- Modify: `src/pages/CrawlPage.tsx`

- [ ] **Step 1: isAdmin + auth.** `const auth = useAuthContext()`; pass `isAdmin={auth?.isAdmin ?? false}` to `CrawlCommentThread`.
- [ ] **Step 2: Check-offs + progress.** State `checkedIds`, hydrate via `loadCrawlCheckoffs(crawl.id)` once data is ready; `toggleChecked(itemId)` updates state + `saveCrawlCheckoffs`. Above the `<ol>` when `items.length > 0`:

```tsx
<div className="card-soft px-4 py-3 mb-4 flex items-center gap-3">
  <span className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 shrink-0">On the crawl</span>
  <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden border border-night-900/20">
    <div className="h-full bg-sauce-400 transition-all duration-500"
         style={{ width: `${items.length ? Math.round((checkedCount / items.length) * 100) : 0}%` }} />
  </div>
  <span className="text-xs font-extrabold text-sauce-500 shrink-0">{checkedCount}/{items.length}</span>
</div>
```

where `checkedCount = items.filter(i => checkedIds.has(i.id)).length` (ignores stale stored ids).

- [ ] **Step 3: Item action row.** In `CrawlItemRow` add props `checked: boolean; onToggleChecked: () => void`. Below the header Link, insert:

```tsx
<div className="border-t-2 border-night-900/10 px-4 py-2 flex items-center gap-2">
  <button
    type="button"
    onClick={onToggleChecked}
    aria-pressed={checked}
    className={`min-h-[44px] px-3 rounded-xl border-2 text-xs font-extrabold uppercase tracking-crowd transition-colors ${
      checked
        ? 'bg-gold-100 border-gold-300 text-gold-700'
        : 'bg-cream-50 border-night-900/20 text-charcoal-500 hover:border-sauce-400'
    }`}
  >
    {checked ? '✓ Been here' : 'Check off'}
  </button>
  {spot.lat != null && spot.lng != null && (
    <a
      href={directionsUrl(spot.lat, spot.lng)}
      target="_blank" rel="noopener noreferrer"
      className="min-h-[44px] px-3 inline-flex items-center rounded-xl border-2 border-night-900/20 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:border-sauce-400 hover:text-sauce-500 transition-colors"
    >
      Directions ↗
    </a>
  )}
</div>
```

- [ ] **Step 4: Dead link.** In `CrawlItemRow`, extract the header content to `const header = (<div className="flex items-start gap-3">…</div>)`; render `spot.slug ? <Link to={…} className="block p-4 hover:bg-cream-100/50 transition-colors">{header}</Link> : <div className="block p-4">{header}</div>`.
- [ ] **Step 5: Numbering coherence.** Number chip renders for every item: rank prop becomes `index + 1` always; style ranked (`bg-sauce-400 …` existing) vs unranked (`bg-cream-200 text-night-800 border-2 border-night-900`) via new `ranked: boolean` prop.
- [ ] **Step 6: Private share honesty.** In the header actions, when `!crawl.is_public`: replace `<ShareButton …/>` with

```tsx
<Link to={`/lists/${crawl.id}/edit`} className="inline-flex items-center gap-1.5 min-h-[44px] -my-2 px-2 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:text-sauce-500 transition-colors">
  🔒 Private
</Link>
```

(only owners can see private lists, so the edit link is always valid here).

- [ ] **Step 7: Author-link touch target.** Wrap the author `Link` with `inline-flex items-center min-h-[44px] -my-3` classes.
- [ ] **Step 8:** Build passes. Commit `feat: on-crawl mode (check-offs + directions) and CrawlPage fixes`.

### Task 9: useCrawlComments — hydrated optimistic comments + error surfacing

**Files:**
- Modify: `src/hooks/useCrawlComments.ts`

- [ ] **Step 1:** `import toast from 'react-hot-toast'`; `import { useAuthContext } from '../components/AuthProvider'`; inside the hook: `const auth = useAuthContext()`.
- [ ] **Step 2:** Temp comment fields:

```ts
commenter_name: auth?.profile?.display_name ?? auth?.profile?.full_name ?? null,
commenter_avatar: auth?.profile?.avatar_url ?? null,
commenter_email: auth?.user?.email ?? null,
```

(add `auth` to `addComment` deps.)

- [ ] **Step 3:** In the insert-error rollback branch add `toast.error("Couldn't post your comment")`. In `deleteComment`'s rollback add `toast.error("Couldn't delete comment")`.
- [ ] **Step 4:** Build passes. Commit `fix: crawl comments show your name instantly and surface failures`.

### Task 10: CoverImagePicker — no silent rejection, sane targets

**Files:**
- Modify: `src/components/ui/CoverImagePicker.tsx`

- [ ] **Step 1:** `maxBytes` default → `20 * 1024 * 1024`; on reject: `toast.error(\`That image is too big (max ${Math.round(maxBytes / 1024 / 1024)} MB)\`)` (import toast). Compression downstream handles big-but-valid files.
- [ ] **Step 2:** `accept="image/jpeg,image/png,image/webp"` (GIFs were silently flattened to JPEG).
- [ ] **Step 3:** Change/Remove buttons: add `min-h-[44px] px-2 -my-2`; hint text `text-charcoal-400` → `text-charcoal-500`; helper copy "JPG, PNG, WebP · max 20 MB".
- [ ] **Step 4:** Build passes. Commit `fix: cover picker feedback + touch targets`.

### Task 11: GalleryView — persistent create button, pagination, scroll restore, tab targets

**Files:**
- Modify: `src/components/gallery/GalleryView.tsx`

- [ ] **Step 1:** Crawls tab header row (renders above cards whenever not loading/error):

```tsx
<div className="flex items-center justify-between mb-3">
  <span className="text-xs text-charcoal-500">{crawls.length}{crawlsHasMore ? '+' : ''} lists</span>
  <button onClick={() => { if (requireAuth()) navigate('/lists/new') }} className="btn-secondary text-xs px-3 py-2">
    + New list
  </button>
</div>
```

- [ ] **Step 2:** Pagination: `const CRAWLS_PAGE = 20`; state `crawlsPage` (reset to 1 on reloadKey); query `.limit(crawlsPage * CRAWLS_PAGE + 1)`; `crawlsHasMore = data.length > crawlsPage * CRAWLS_PAGE`; slice to `crawlsPage * CRAWLS_PAGE`; "Load more" button below the cards when `crawlsHasMore` sets `crawlsPage(p => p + 1)`. Effect deps gain `crawlsPage`.
- [ ] **Step 3:** Scroll restore: extend the existing restore effect to also run for the crawls tab once `!crawlsLoading` (save side already keys by feed — verify the save handler location and include crawls; if saving is unmount/навigation-based per feed key it already covers crawls).
- [ ] **Step 4:** Tab pills `py-1.5` → `py-2.5` (≥40px tall with border; acceptable given row spacing).
- [ ] **Step 5:** Build passes. Commit `feat: lists feed — create button, pagination, scroll restore`.

### Task 12: CrawlFeedCard — honest affordances

**Files:**
- Modify: `src/components/gallery/CrawlFeedCard.tsx`

- [ ] **Step 1:** Private badge: eyebrow becomes `{crawl.is_ranked ? 'Ranked list' : 'List'}{!crawl.is_public && ' · Private'}{' · '}{count…}`.
- [ ] **Step 2:** Real author link: when `authorLinkable`, render

```tsx
<button
  type="button"
  onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/u/${crawl.author_username}`) }}
  className="font-extrabold uppercase tracking-crowd text-night-800 hover:text-sauce-500 transition-colors min-h-[44px] -my-3 inline-flex items-center"
>
  {crawl.author_name}
</button>
```

- [ ] **Step 3:** Tappable like (optimistic, auth-gated):

```ts
const { requireAuth } = useAuthGate()
const auth = useAuthContext()
const [liked, setLiked] = useState(crawl.is_liked_by_me)
const [likeCount, setLikeCount] = useState(crawl.like_count)
const likeBusyRef = useRef(false)

async function handleLike(e: React.MouseEvent) {
  e.preventDefault(); e.stopPropagation()
  if (!requireAuth() || likeBusyRef.current || !auth?.user) return
  likeBusyRef.current = true
  const was = liked
  setLiked(!was); setLikeCount(c => c + (was ? -1 : 1))
  const { error } = await toggleCrawlLike(crawl.id, auth.user.id, was)
  if (error) { setLiked(was); setLikeCount(c => c + (was ? 1 : -1)); toast.error('Could not update like') }
  likeBusyRef.current = false
}
```

Heart renders always (not only when count > 0) as a `<button aria-label={liked ? 'Unlike list' : 'Like list'} className="ml-auto min-h-[44px] -my-3 px-2 inline-flex items-center gap-1 …">` with count shown when `likeCount > 0`.

- [ ] **Step 4:** Build passes. Commit `fix: crawl feed card — private badge, real author link, tappable like`.

### Task 13: Naming + navigation (AppHeader, EventsIndex) and header back logic

**Files:**
- Modify: `src/components/AppHeader.tsx`, `src/pages/EventsIndex.tsx`

- [ ] **Step 1: AppHeader menu.** "Crawls" MenuItem label → `Events`; add above it: `<MenuItem onClick={() => { setProfileOpen(false); navigate('/?tab=crawls') }}>Lists</MenuItem>`. Keep "+ New list".
- [ ] **Step 2: Back logic.** `handleBack`: replace referrer check with `if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) navigate(-1); else navigate('/')`.
- [ ] **Step 3: EventsIndex copy.** Helmet title `Events — WingKingTony`; H1 `Events`; eyebrow `Group crawls`; error copy "Couldn't load events…" / empty copy "No events yet".
- [ ] **Step 4:** Build passes. Commit `fix: navigation naming — Events vs Lists, reliable back button`.

### Task 14: EventPage — zero render, reset errors, map gestures

**Files:**
- Modify: `src/pages/EventPage.tsx`

- [ ] **Step 1:** Line 504: `{stop.checkin_count && stop.checkin_count > 0 && (` → `{(stop.checkin_count ?? 0) > 0 && (`.
- [ ] **Step 2:** `handleResetProgress`: collect results and check errors:

```ts
const results = await Promise.all([...same three deletes...])
const firstError = results.map(r => r.error).find(Boolean)
if (firstError) { toast.error(`Reset failed: ${firstError.message}`); return }
```

(keep the success path after; the catch stays for thrown/network errors.)

- [ ] **Step 3:** `RouteMap` map options gain `dragging: !L.Browser.mobile` (same rationale as Task 7).
- [ ] **Step 4:** Build passes. Commit `fix: event page zero-render, silent reset failures, map scroll trap`.

### Task 15: UserProfilePage list cards — cover + likes

**Files:**
- Modify: `src/pages/UserProfilePage.tsx` (lists section, lines 315-333)

- [ ] **Step 1:** Inside each card Link, before the title, when `c.cover_image_url`:

```tsx
<div className="aspect-[16/9] -mx-4 -mt-4 mb-3 overflow-hidden rounded-t-[10px] border-b-2 border-night-900 bg-night-800">
  <img src={c.cover_image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
</div>
```

- [ ] **Step 2:** Meta line gains likes when `c.like_count > 0`: `· ♥ {c.like_count}`.
- [ ] **Step 3:** Build passes. Commit `feat: profile list cards show cover + likes`.

### Task 16: Verification sweep

- [ ] **Step 1:** `npm run lint`, `npm run build`, `npx vitest run` (Node 22) — all green.
- [ ] **Step 2:** Browser smoke (playwright-core recipe, READ-ONLY, viewport 390×844): Lists tab shows "+ New list"; list page shows progress bar + Directions/Check-off row (only if a list with items exists — otherwise verify empty states); `/lists/new` logged out → login; back button from list → Lists tab. Screenshots to job tmp dir.
- [ ] **Step 3:** DB re-check: `get_advisors` security — crawl_likes lints gone; slug transaction test (Task 1 Step 3) if not yet run.
- [ ] **Step 4:** Final commit if stragglers; report deferred items (private-cover signed URLs, bucket listing lint, RLS initplan perf lint, toast-undo keyboard a11y, full card unification).

## Self-review notes

- Spec coverage: review findings #1-17 frontend + DB action items 1-4 all mapped; deferred items listed in Task 16 Step 4 are consciously out of scope and reported as such.
- `useBlocker` avoided everywhere (BrowserRouter). Draft persistence replaces nav-blocking for the new form; autosave removes the need in edit mode.
- Type consistency: `directionsUrl(lat, lng)`, `loadCrawlCheckoffs(crawlId)`, `saveCrawlCheckoffs(crawlId, ids)` used identically in Tasks 3 and 8. `CrawlRouteMap` `ranked` prop removed in Task 7 — Task 8 must not pass it (CrawlPage call site updated there; CrawlEditor call site updated in Task 7).
