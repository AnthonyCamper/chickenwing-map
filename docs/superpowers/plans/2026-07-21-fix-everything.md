# WingKingTony "Fix Everything" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the production Supabase data layer (view regression, security holes, broken push), fix all confirmed frontend bugs, close the critical product-completeness gaps (search, rebrand, password reset, ErrorBoundary, 404), and land the iOS polish items — then verify, commit, and deploy.

**Architecture:** One recorded prod migration fixes the DB (executed by the coordinator via the `supabase-wing` MCP — NEVER any other supabase MCP server; project ref `nzovofzjqjvxbzvelhyd`). Frontend work is split into four disjoint file-ownership domains (A: hooks/actions, B: pages/branding/App shell, C: ListView/search, D: gallery components/iOS polish) executed by parallel subagents that DO NOT COMMIT — the coordinator reviews, commits per domain, and runs global verification.

**Tech Stack:** React 18 + TypeScript + Vite 8 + Tailwind 3 + supabase-js v2 + Leaflet. Tests: vitest + @testing-library/react (jsdom).

## Global Constraints

- Build/tests MUST run with Node 22: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"` (system node is 20.11, too old for Vite 8).
- Verification commands: `npx tsc --noEmit` (must exit 0), `npm test` (vitest run, must pass), `npm run build` (must succeed under Node 22).
- supabase-js v2 query builders NEVER throw — they resolve `{ data, error }`. All new/fixed call sites must check `error` explicitly. Model after `src/hooks/useCrawlComments.ts:289-305`.
- Brand: the app is **WingKingTony** (night/sauce/cream comic palette — see `src/pages/PendingApproval.tsx` and `src/pages/SpotPage.tsx` for the reference style). No new "WingMap" copy.
- Subagents MUST NOT run `git commit`/`git add`. Coordinator commits.
- DB work goes ONLY through `mcp__supabase-wing__*` tools. The `supabase-pepperoni`/`supabase-taliascoffee`/`supabase-wingapp` servers are other projects — do not touch.
- Every SQL statement in the migration must be idempotent-safe where possible (`IF NOT EXISTS` / `DROP ... IF EXISTS` before create).

---

## Phase 1 — Production DB repair (coordinator executes, Task 1–3)

### Task 1: Author + apply migration `022_repair_views_and_security.sql`

**Files:**
- Create: `supabase/migrations/022_repair_views_and_security.sql`
- Apply live via `mcp__supabase-wing__apply_migration` (name: `repair_views_and_security`)

**Pre-flight checks (run as read-only SQL first; adjust the migration if reality differs):**
- [ ] `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname LIKE 'notify_%';` — copy the pattern of the existing `notify_crawl_like` function for the new review-like/reaction triggers, and confirm which `type` values `notifications` accepts (enum or CHECK).
- [ ] Confirm avatar upload path shape: read `src/components/ProfileModal.tsx` upload code; the storage policy folder check must match (expected `<uid>/...` → `(storage.foldername(name))[1] = auth.uid()::text`). If the app writes flat paths, adapt the policy to `name LIKE auth.uid()::text || '%'` or skip and note.
- [ ] `SELECT polname, polcmd, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) FROM pg_policy WHERE polrelid IN ('wing_crawls','wing_crawl_items','crawl_comments','crawl_likes','follows','notifications','ai_headlines','push_subscriptions')::regclass[]` — actually query each `'table'::regclass` individually; capture exact policy names for DROP POLICY statements.
- [ ] Confirm DM table names (`dm_threads`, `dm_messages`?) via `list_tables` before adding `is_approved()` to their policies.
- [ ] For each of the 11 non-core SECURITY DEFINER views, check the base tables' SELECT policies allow the intended audience under invoker semantics BEFORE flipping (`wing_crawls_detailed` needs public crawls readable by anon when site public; `public_profiles` relies on profiles SELECT policy).

**Migration contents (in this order):**

- [ ] **1. Recreate the two core views per 018 with `security_invoker`** — verbatim column lists from `supabase/migrations/018_multi_sauce.sql:42-120` (includes `spot_lat/lng`, `event_slug/name`, `spot_slug`, `reviewer_username`, `reviewer_is_private`, `wing_flavors`):

```sql
DROP VIEW IF EXISTS public.gallery_feed;
DROP VIEW IF EXISTS public.reviews_with_profiles;

CREATE VIEW public.reviews_with_profiles WITH (security_invoker = true) AS
SELECT r.id, r.wing_spot_id, r.user_id, r.overall_rating, r.wing_size,
       r.wing_flavor, r.is_takeout, r.takeout_container, r.review_text,
       r.visited_at, r.legacy_data, r.event_id, r.event_stop_id,
       r.created_at, r.updated_at,
       p.display_name AS reviewer_name, p.avatar_url AS reviewer_avatar,
       p.email AS reviewer_email,
       ws.name AS spot_name, ws.address AS spot_address,
       ws.lat AS spot_lat, ws.lng AS spot_lng,
       e.slug AS event_slug, e.name AS event_name,
       ws.slug AS spot_slug, p.username AS reviewer_username,
       p.is_private AS reviewer_is_private, r.wing_flavors
FROM reviews r
JOIN profiles p ON p.id = r.user_id
JOIN wing_spots ws ON ws.id = r.wing_spot_id
LEFT JOIN events e ON e.id = r.event_id;

CREATE VIEW public.gallery_feed WITH (security_invoker = true) AS
SELECT rp.id AS photo_id, rp.url AS photo_url, rp.display_order,
       rp.created_at AS photo_created_at, rp.review_id,
       r.wing_spot_id, r.overall_rating, r.wing_flavor, r.review_text,
       r.visited_at, r.user_id AS reviewer_id, r.event_id,
       ws.name AS spot_name, ws.address AS spot_address,
       COALESCE(p.display_name, p.full_name) AS reviewer_name,
       p.avatar_url AS reviewer_avatar, p.email AS reviewer_email,
       COALESCE(lk.cnt, 0) AS like_count, COALESCE(cm.cnt, 0) AS comment_count,
       e.slug AS event_slug, e.name AS event_name,
       CASE WHEN auth.uid() IS NOT NULL THEN
         (EXISTS (SELECT 1 FROM review_likes rl WHERE rl.review_id = r.id AND rl.user_id = auth.uid()))
       ELSE false END AS is_liked_by_me,
       ws.slug AS spot_slug, p.username AS reviewer_username,
       p.is_private AS reviewer_is_private, r.wing_flavors
FROM review_photos rp
JOIN reviews r ON rp.review_id = r.id
JOIN wing_spots ws ON r.wing_spot_id = ws.id
JOIN profiles p ON r.user_id = p.id
LEFT JOIN events e ON e.id = r.event_id
LEFT JOIN LATERAL (SELECT count(*)::integer AS cnt FROM review_likes WHERE review_likes.review_id = r.id) lk ON true
LEFT JOIN LATERAL (SELECT count(*)::integer AS cnt FROM review_comments WHERE review_comments.review_id = r.id) cm ON true
ORDER BY rp.created_at DESC;
```

- [ ] **2. Flip remaining definer views to invoker** (after per-view pre-flight): `ALTER VIEW public.<v> SET (security_invoker = true);` for `leaderboard_stats, social_feed, following_feed, user_posts_grid, public_profiles, dm_threads_with_profiles, follows_with_profiles, event_rsvps_with_profiles, event_stops_with_spots, wing_crawls_detailed, crawl_comments_detailed`. If a view breaks under invoker (missing base-table SELECT policy for its legitimate audience), add the narrow SELECT policy rather than reverting to definer.
- [ ] **3. Fix push:** `ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_user_endpoint_key UNIQUE (user_id, endpoint);` (guard with a DO block checking pg_constraint) + `CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());`
- [ ] **4. Lock notifications inserts:** DROP the `WITH CHECK (true)` INSERT policy (exact name from pre-flight). Notification triggers are SECURITY DEFINER (owner bypasses RLS) so they keep working — verify by inserting a review comment afterward.
- [ ] **5. Lock ai_headlines:** drop `ai_headlines_public_insert/update/delete` policies. Edge function uses service role (bypasses RLS).
- [ ] **6. Approval enforcement:** recreate INSERT/UPDATE/DELETE policies on `wing_crawls, wing_crawl_items, crawl_comments, crawl_likes, crawl_comment_likes, crawl_comment_reactions, follows` (+ DM tables) adding `AND public.is_approved()` to existing conditions. Storage: add `is_approved()` to `user-avatars` and `crawl-covers` INSERT policies, plus avatar folder-ownership check per pre-flight.
- [ ] **7. Attribution pinning:** reviews INSERT → `WITH CHECK (can_review() AND user_id = auth.uid())`; review_photos INSERT → `WITH CHECK (can_review() AND EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.user_id = auth.uid()))`. Leave `wing_spots` UPDATE as `can_review()` — the createReview upsert path needs it (document this accepted risk in the migration comment).
- [ ] **8. Like/reaction notifications:** new SECURITY DEFINER trigger functions `notify_review_like()` and `notify_review_reaction()` on `review_likes`/`review_reactions` AFTER INSERT, modeled byte-for-byte on the live `notify_crawl_like` definition (self-like guard: skip when actor = review owner; use whatever `type` value the legacy photo-like trigger used, e.g. `'like'`/`'reaction'` — confirm against the enum in pre-flight).
- [ ] **9. Hot-path FK indexes:** `CREATE INDEX IF NOT EXISTS` on `review_photos(review_id)`, `reviews(wing_spot_id)`, `reviews(user_id)`, `review_likes(user_id)`, `notifications(review_id)`, `notifications(actor_id)`, `follows(following_id)`.
- [ ] **10. Dedupe follows policies:** drop `follows_select_all`, `follows_insert`, `follows_delete` duplicates (keep the `_own`-scoped set; exact names from pre-flight).

**Verification:**
- [ ] `curl -s "$URL/rest/v1/gallery_feed?select=*&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` (env from `.env.local`) → keys include `wing_flavors`, `spot_slug`, `reviewer_is_private`, `spot_lat`.
- [ ] Same for `reviews_with_profiles?select=id,spot_slug,spot_lat,reviewer_is_private&limit=1` → 200, not 42703.
- [ ] Anon insert into `notifications` via REST → 401/42501 (denied).
- [ ] `INSERT INTO push_subscriptions ... ON CONFLICT (user_id, endpoint)` smoke test via SQL with a fake row, then delete it.
- [ ] Re-run `mcp__supabase-wing__get_advisors` security — the 13 `security_definer_view` ERRORs are gone; `rls_policy_always_true` on notifications gone.

### Task 2: Fix `send-push` edge-function branding

- [ ] Read live function via `mcp__supabase-wing__get_edge_function` (`send-push`); replace fallback title "Talia's Coffee" → "WingKingTony" and VAPID subject `mailto:admin@talias.coffee` → `mailto:anthonycap949@gmail.com`; redeploy via `deploy_edge_function`. No other logic changes.

### Task 3: Migration-history hygiene (repo only)

- [ ] Move the untracked, already-applied `supabase/migrations/006_fix_review_views_wing_column_names.sql` to `supabase/remote_history/20260621235911_fix_review_views_wing_column_names.sql` (new dir) with a README line noting it was applied live on 2026-06-21 and superseded by 022. Resolves the duplicate-006 ordering break.
- [ ] Delete `HANDOFF.md` (its plan is now executed/superseded by this plan + 022).
- [ ] Commit: `git add -A supabase docs && git commit -m "db: repair prod views + security hardening (migration 022)"`.

---

## Phase 2 — Frontend fixes, four parallel domains (subagents; no commits)

### Task A: Hooks, actions, auth (owns: `src/hooks/*` except useBottomSheetDrag, `src/lib/reviewActions.ts`, `src/lib/types.ts`, `src/components/ReviewCard.tsx`, `src/components/ReviewFormModal.tsx`, `src/components/ui/Modal.tsx`, `src/pages/SpotPage.tsx`, `src/pages/ReviewPage.tsx`, `src/pages/Home.tsx`)

1. **Error-checked optimistic rollbacks** (pattern: `useCrawlComments.ts:289-305` — capture snapshot, apply optimistic state, `const { error } = await ...`, on error restore snapshot + `toast.error(...)`):
   - `useGallery.ts:198-218` toggleLike; `useReviewComments.ts:264-279, 316-336` + fetch error at `:76-83` (set error state instead of silent empty) + `deleteComment :219-236`; `useReviewReactions.ts:83-97`; `usePhotoDetail.ts:34-43` (+ `.single()` error at `:15-24` → toast); `useFollow.ts:45-56`; `useAuth.ts:250-264` updateProfile returns/toasts error.
2. **useGallery cache correctness**:
   - Cross-feed poisoning: when `cacheKey` changes, synchronously seed `photos` from `feedCache.get(newKey) ?? []` before any render that could write back; the cache-sync effect must only write when the data it holds belongs to the current key (track `loadedKeyRef`). Also reset `offsetRef` from the cached entry's length.
   - Export `invalidateGalleryFeedCache()` clearing the module cache; call it after create/update/delete in `reviewActions.ts` (createReview/updateReview/deleteReview).
   - Dedup in `groupByReview` by `photo_id` and drop already-seen `review_id` groups when appending pages.
   - `loadMore` failure: keep existing items, `toast.error('Couldn't load more')`, clear `error` on next success; only set full `error` state when the list is empty.
3. **ReviewCard undo-delete** (`ReviewCard.tsx:47-94`): on unmount with a pending deletion, flush it (call the delete immediately) instead of clearing the timer. Add vitest: render, trigger delete, unmount before 5s, assert `onDelete` called once (use `vi.useFakeTimers`).
4. **reviewActions.ts**: dual-write `wing_flavors` (array from the picker's single value: `wing_flavor ? [wing_flavor] : []`, or split on ', ' when editing legacy) in create+update; check the `review_photos` insert error (`:90`) and remove the uploaded storage object on failure; count failed photo uploads and toast "N photo(s) failed to upload" instead of silent success; `deleteReview` first `SELECT url FROM review_photos WHERE review_id=...`, derive storage paths, `storage.from('review-photos').remove(paths)`, then delete the review row. HEIC/compress failure fallback: if `compressImage` rejects, upload the original file instead of skipping.
5. **useAuth.ts:79-91**: on profile-fetch *error* (not "no row"), retain previous status/profile instead of demoting to `pending`.
6. **SpotPage.tsx:188,215**: gate the review form on the same `canLeaveReviews` flag Home uses (`Home.tsx:163`); remove the duplicate success toast (keep the modal's own "Review added!"); pass real `isAdmin` to review cards (`SpotPage.tsx:229`), same in `ReviewPage.tsx:158` (source: same admin check Home uses).
7. **Small fixes**: `Modal.tsx:34-38` Escape only closes the topmost modal (track a module-level modal stack like useFocusTrap does); `ReviewFormModal.tsx:30` compute `today` when the modal opens, not at module load; `useNotifications.ts:171-173` dispatch `crawlSlug` in the `push-deep-link` event detail (match `Home.tsx:128`); `useHistoryModal.ts:19-29` pop the pushed history entry on unmount-while-open.
8. Run `npx tsc --noEmit` + `npm test` (Node 22 PATH) until green. Report changed files + behaviors.

### Task B: Pages, branding, app shell (owns: `src/App.tsx`, `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/pages/EventsIndex.tsx`, `src/pages/EventPage.tsx`, `src/pages/AdminDashboard.tsx` + admin components' palette only, `src/pages/CrawlPage.tsx`, `src/components/ErrorBoundary.tsx` (new), `src/pages/NotFound.tsx` (new), `src/pages/ResetPassword.tsx` (new), `src/components/ui/ShareButton.tsx` (new), `src/components/gallery/GalleryView.tsx` error branches, `src/components/gallery/PeopleView.tsx` error branch, `src/components/AppHeader.tsx` error branch)

1. **Rebrand Login/Register/EventsIndex/EventPage/AdminDashboard** to the WingKingTony night/sauce/cream style — copy tokens/classes from `PendingApproval.tsx` and `SpotPage.tsx`; replace "WingMap … A private corner" copy with WingKingTony branding. Keep all logic identical.
2. **Password reset**: Login gains "Forgot password?" → `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${import.meta.env.BASE_URL}reset-password` })`; new `/reset-password` route/page that calls `supabase.auth.updateUser({ password })` after the recovery session lands (listen for `PASSWORD_RECOVERY` event via useAuth's existing listener or `onAuthStateChange` locally). Handle GH-Pages hash routing carefully — test the redirect URL shape against `App.tsx` router config (BrowserRouter + 404.html trick).
3. **ErrorBoundary** (new class component, branded fallback + "Reload" button) wrapping routes in `App.tsx`.
4. **404 page**: replace `App.tsx:218` silent redirect with a branded NotFound page (reuse the `PageStateShell` pattern from SpotPage) with a "Back to the map" link.
5. **Retry + honest error states**: `GalleryView.tsx:165-168` full-screen error only when list empty, with Retry button wired to `refresh()`; error branches (instead of fake empty states) for the crawls tab fetch (`GalleryView.tsx:86-96`), `EventsIndex.tsx:13-22`, `PeopleView.tsx:27-39`, AppHeader active-event fetch.
6. **Toaster safe-area**: `App.tsx:91` → `top: 'calc(20px + env(safe-area-inset-top))'`.
7. **ShareButton** (Web Share API with clipboard fallback + toast) used on `SpotPage`… (SpotPage is owned by A — instead: export the component; coordinator wires SpotPage/ReviewPage usage in integration commit; B wires it into `CrawlPage` and `EventPage` which B owns).
8. **document.title**: add react-helmet-async titles to Home (per view), EventsIndex, EventPage, AdminDashboard, Login, Register.
9. Run `npx tsc --noEmit` + `npm test`. Report changed files.

### Task C: ListView + search (owns: `src/components/ListView.tsx` only)

1. **Spot search**: text input (`.input` class → 16px, fixes the iOS zoom finding) filtering spots by name/address/flavor (case-insensitive substring over the already-loaded data).
2. **"Near me" sort**: add sort option using `navigator.geolocation` (request on demand; haversine distance; graceful toast if denied).
3. **Reviewer-filter stat bug** (`ListView.tsx:44-58, 274`): when a reviewer filter is active, recompute the displayed avg/count from the filtered reviews.
4. **Kill the 11px select** (`ListView.tsx:129-135`): restyle to ≥16px font.
5. Run `npx tsc --noEmit` + `npm test`. Report changed files.

### Task D: Gallery components + iOS polish (owns: `src/components/gallery/*` except GalleryView/PeopleView, `src/components/PhotoCard.tsx`, `src/components/ui/PhotoUpload.tsx`, `src/index.css`, `package.json`)

1. **Carousel swipe**: add touch-swipe navigation to `ReviewFeedCard.tsx:103-139`, `gallery/ReviewCard.tsx:36-51`, `PhotoModal.tsx:167-212` — reuse the exact touch-handler pattern from `PhotoLightbox.tsx:42-65` (threshold-based touchstart/touchend delta).
2. **Keyboard-safe composer**: in `PhotoModal.tsx`, listen to `window.visualViewport` `resize`/`scroll` and cap the sheet height / translate the pinned composer so it stays visible above the iOS keyboard; guard for browsers without visualViewport.
3. **Tap targets**: gallery `ReviewCard.tsx:39-48` dots get 24px hit areas (copy `ReviewFeedCard.tsx:121-137` pattern); `PhotoModal` close buttons `:306-311`, `:504-509` → `w-11 h-11`; cancel-reply/remove-GIF ×-buttons (`PhotoModal.tsx:368-380`, `CommentSection.tsx:187-191`) and `PhotoUpload.tsx:94-101` remove button → ≥28px with padding hit-slop.
4. **index.css**: drop `background-attachment: fixed` (`index.css:34`) — move the grain texture to a `position: fixed; inset: 0; pointer-events: none; z-index: -1` `body::before` pseudo-element.
5. **Remove `framer-motion`** from package.json (zero imports — verify with grep first), run `npm install` to update the lockfile.
6. Run `npx tsc --noEmit` + `npm test`. Report changed files.

---

## Phase 3 — Integration, verification, ship (coordinator)

- [ ] Review each domain's diff (`git diff` per ownership list); resolve any accidental overlap; wire ShareButton into SpotPage/ReviewPage.
- [ ] Full gate under Node 22: `npx tsc --noEmit` && `npm test` && `npm run build` — all green.
- [ ] Manual REST smoke of the two views + one authenticated flow if feasible.
- [ ] Commit per domain (`fix(hooks): …`, `feat(pages): …`, `feat(list): search + near-me`, `fix(ios): …`), all on `master` per repo convention.
- [ ] Deploy: `npm run deploy` (GH Pages). Confirm the live site loads and gallery cards show flavors/spot links.

## Deferred (needs product decisions — NOT in this plan)

Crawls-vs-Lists vocabulary unification; OG prerendering for social scrapers (infra); offline PWA caching; delete-account (needs service-role flow); user-editable usernames; wing_spots UPDATE lockdown (blocked by the upsert flow).
