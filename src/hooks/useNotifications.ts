import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import type { Notification, NotificationPreferences } from '../lib/types'
import {
  isPushSupported,
  isSubscribedToPush,
  subscribeToPush,
  unsubscribeFromPush,
  triggerPushDelivery,
} from '../lib/pushManager'

export interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  preferences: NotificationPreferences | null
  pushSupported: boolean
  pushSubscribed: boolean
  pushPermission: NotificationPermission | 'unsupported'
  // Actions
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  loadMore: () => Promise<void>
  hasMore: boolean
  // Push management
  enablePush: () => Promise<{ success: boolean; error?: string; needsInstall?: boolean }>
  disablePush: () => Promise<void>
  // Preferences
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>
  refreshPreferences: () => Promise<void>
}

const PAGE_SIZE = 20
// A header that mounts within this long of the last load reuses it instead
// of fetching again. Realtime INSERTs keep the list and count current in
// between; this only bounds how stale things get if that channel drops.
const REFRESH_AFTER_MS = 60_000
// Keep the realtime channel through a page change: the old page's header
// unmounts just before the new page's header mounts.
const CHANNEL_LINGER_MS = 5_000

// ── Shared store ─────────────────────────────────────────────────────────────
// Every page renders its own AppHeader, so a per-component hook refetched the
// list, the unread count (a HEAD request) and the preferences, and tore down
// and re-opened the realtime channel, on every navigation — wasted round
// trips on 3G. One store per signed-in user is shared by all mounted headers.

interface StoreState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  preferences: NotificationPreferences | null
  pushSubscribed: boolean
  hasMore: boolean
}

interface Store {
  userId: string
  state: StoreState
  offset: number
  fetchedAt: number
  loadPromise: Promise<void> | null
  refs: number
  teardownTimer: ReturnType<typeof setTimeout> | null
  teardown: (() => void) | null
}

const SIGNED_OUT_STATE: StoreState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  preferences: null,
  pushSubscribed: false,
  hasMore: false,
}

let store: Store | null = null
const listeners = new Set<() => void>()

function subscribeStore(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function setState(s: Store, patch: Partial<StoreState> | ((prev: StoreState) => Partial<StoreState>)) {
  if (store !== s) return // a different user signed in meanwhile
  const next = typeof patch === 'function' ? patch(s.state) : patch
  s.state = { ...s.state, ...next }
  listeners.forEach(l => l())
}

function getStore(userId: string): Store {
  if (store?.userId === userId) return store
  if (store) {
    if (store.teardownTimer) clearTimeout(store.teardownTimer)
    store.teardown?.()
  }
  store = {
    userId,
    state: { ...SIGNED_OUT_STATE, loading: true, hasMore: true },
    offset: 0,
    fetchedAt: 0,
    loadPromise: null,
    refs: 0,
    teardownTimer: null,
    teardown: null,
  }
  return store
}

async function fetchPage(s: Store, offset: number, append: boolean) {
  if (offset === 0) setState(s, { loading: true })
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', s.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (!error && data) {
    const rows = data as Notification[]
    s.offset = offset + rows.length
    setState(s, prev => ({
      hasMore: rows.length === PAGE_SIZE,
      notifications: append ? [...prev.notifications, ...rows] : rows,
    }))
  }
  setState(s, { loading: false })
}

async function fetchUnreadCount(s: Store) {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', s.userId)
    .eq('read', false)
  setState(s, { unreadCount: count ?? 0 })
}

async function fetchPreferences(s: Store) {
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', s.userId)
    .maybeSingle()
  if (data) setState(s, { preferences: data as NotificationPreferences })
}

/** Load (or refresh, if stale) the list, unread count and preferences once. */
function ensureLoaded(s: Store) {
  if (s.loadPromise) return
  if (s.fetchedAt && Date.now() - s.fetchedAt < REFRESH_AFTER_MS) return
  s.fetchedAt = Date.now()
  s.loadPromise = Promise.all([
    fetchPage(s, 0, false),
    fetchUnreadCount(s),
    fetchPreferences(s),
    isSubscribedToPush().then(pushSubscribed => setState(s, { pushSubscribed })),
  ])
    .catch(() => { s.fetchedAt = 0 }) // retry on the next mount
    .then(() => { s.loadPromise = null })
}

/** Realtime channel + service-worker listener, shared by every mounted header. */
function startLive(s: Store): () => void {
  const channel = supabase
    .channel(`notifications-realtime-${s.userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${s.userId}`,
      },
      (payload) => {
        const newNotif = payload.new as Notification
        setState(s, prev => ({
          notifications: [newNotif, ...prev.notifications],
          unreadCount: prev.unreadCount + 1,
        }))
      }
    )
    .subscribe()

  // ── Notification clicks from the service worker ──
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      const { notificationId, url } = event.data
      if (notificationId) {
        // Mark as read
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId)
          .then(() => {
            setState(s, prev => ({
              notifications: prev.notifications.map(n => n.id === notificationId ? { ...n, read: true } : n),
              unreadCount: Math.max(0, prev.unreadCount - 1),
            }))
          })
      }
      // Navigate if the app is open — dispatch event so Home can handle
      // without a full page reload
      if (url) {
        const parsed = new URL(url, window.location.origin)
        const photoId = parsed.searchParams.get('photo')
        const reviewId = parsed.searchParams.get('review')
        const commentId = parsed.searchParams.get('comment')
        // Crawl pushes deep-link by path (/lists/<slug>) rather than query param
        const crawlSlug = parsed.pathname.match(/^\/lists\/([^/]+)/)?.[1] ?? null
        if (photoId || reviewId || crawlSlug) {
          window.dispatchEvent(new CustomEvent('push-deep-link', {
            detail: { photoId, reviewId, commentId, crawlSlug },
          }))
        } else if (url !== window.location.pathname + window.location.search) {
          window.location.href = url
        }
      }
    }

    if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGE') {
      // Re-register the new subscription
      subscribeToPush(s.userId).then(result => {
        setState(s, { pushSubscribed: result.success })
      })
    }
  }
  navigator.serviceWorker?.addEventListener('message', handleMessage)

  return () => {
    supabase.removeChannel(channel)
    navigator.serviceWorker?.removeEventListener('message', handleMessage)
  }
}

function acquire(s: Store) {
  s.refs += 1
  if (s.teardownTimer) {
    clearTimeout(s.teardownTimer)
    s.teardownTimer = null
  }
  if (!s.teardown) s.teardown = startLive(s)
}

function release(s: Store) {
  s.refs -= 1
  if (s.refs > 0 || !s.teardown) return
  s.teardownTimer = setTimeout(() => {
    s.teardownTimer = null
    if (s.refs > 0) return
    s.teardown?.()
    s.teardown = null
    // Nobody is showing notifications any more (e.g. signed out): the next
    // header to mount loads fresh.
    s.fetchedAt = 0
  }, CHANNEL_LINGER_MS)
}

/** The live store for this user, or null (signed out / another user now). */
function storeFor(userId: string | undefined): Store | null {
  return userId && store?.userId === userId ? store : null
}

/** Test helper: drop the shared store. */
export function _resetNotificationsStoreForTests() {
  if (store) {
    if (store.teardownTimer) clearTimeout(store.teardownTimer)
    store.teardown?.()
  }
  store = null
}

export function useNotifications(userId: string | undefined): UseNotificationsReturn {
  const state = useSyncExternalStore(
    subscribeStore,
    () => storeFor(userId)?.state ?? SIGNED_OUT_STATE,
    () => SIGNED_OUT_STATE,
  )

  const pushSupported = isPushSupported()
  const pushPermission = pushSupported
    ? Notification.permission
    : 'unsupported' as const

  // ── Load once + share the realtime channel ─────────────────────────────

  useEffect(() => {
    if (!userId) return
    const s = getStore(userId)
    acquire(s)
    ensureLoaded(s)
    // getStore may have replaced the store (different user): re-render
    listeners.forEach(l => l())
    return () => release(s)
  }, [userId])

  // ── Actions ────────────────────────────────────────────────────────────

  const markRead = useCallback(async (id: string) => {
    const s = storeFor(userId)
    if (!s) return
    setState(s, prev => ({
      notifications: prev.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }))

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
  }, [userId])

  const markAllRead = useCallback(async () => {
    const s = storeFor(userId)
    if (!userId || !s) return
    setState(s, prev => ({
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }))

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', userId)
      .eq('read', false)
  }, [userId])

  const loadMore = useCallback(async () => {
    const s = storeFor(userId)
    if (!s || !s.state.hasMore) return
    await fetchPage(s, s.offset, true)
  }, [userId])

  const refreshPreferences = useCallback(async () => {
    const s = storeFor(userId)
    if (s) await fetchPreferences(s)
  }, [userId])

  const enablePush = useCallback(async () => {
    if (!userId) return { success: false, error: 'Not logged in.' }
    const result = await subscribeToPush(userId)
    const s = storeFor(userId)
    if (result.success && s) {
      setState(s, { pushSubscribed: true })
      // Ensure preferences have enabled = true
      await supabase
        .from('notification_preferences')
        .upsert({ user_id: userId, enabled: true }, { onConflict: 'user_id' })
      fetchPreferences(s)
    }
    return result
  }, [userId])

  const disablePush = useCallback(async () => {
    if (!userId) return
    await unsubscribeFromPush(userId)
    const s = storeFor(userId)
    if (s) setState(s, { pushSubscribed: false })
  }, [userId])

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    const s = storeFor(userId)
    if (!userId || !s) return
    const { data } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
      .select()
      .maybeSingle()

    if (data) setState(s, { preferences: data as NotificationPreferences })
  }, [userId])

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    preferences: state.preferences,
    pushSupported,
    pushSubscribed: state.pushSubscribed,
    pushPermission,
    markRead,
    markAllRead,
    loadMore,
    hasMore: state.hasMore,
    enablePush,
    disablePush,
    updatePreferences,
    refreshPreferences,
  }
}

// Re-export triggerPushDelivery for use by other hooks
export { triggerPushDelivery }
