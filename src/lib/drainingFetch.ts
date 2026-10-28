/**
 * fetch for the Supabase client that reads the (empty) body of HEAD and 204
 * responses.
 *
 * supabase-js never reads those bodies: count queries (`head: true`, e.g. the
 * unread-notifications badge, follower counts) and POST /auth/v1/logout. The
 * browser then cancels the unread response stream and DevTools / Playwright
 * list a request that actually succeeded as "net::ERR_ABORTED" — which looked
 * like duplicate, aborted requests in QA (S25). Draining it lets the request
 * finish normally. Nothing else changes: same status, headers and ok flag.
 *
 * Wire it in lib/supabase.ts: createClient(url, key, { global: { fetch: drainingFetch }, ... })
 */
export const drainingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  if (method !== 'HEAD' && res.status !== 204) return res
  try { await res.arrayBuffer() } catch { /* nothing to read */ }
  return new Response(null, { status: res.status, statusText: res.statusText, headers: res.headers })
}
