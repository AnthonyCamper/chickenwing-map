import { useCallback, useEffect, useRef, useState } from 'react'
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

export function useNotifications(userId: string | undefined): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)

  const pushSupported = isPushSupported()
  const pushPermission = pushSupported
    ? Notification.permission
    : 'unsupported' as const

  // ── Fetch notifications ──────────────────────────────────────────────────

  const fetchNotifications = useCallback(async (offset: number, append: boolean) => {
    if (!userId) return
    if (offset === 0) setLoading(true)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (!error && data) {
      const rows = data as Notification[]
      setHasMore(rows.length === PAGE_SIZE)
      setNotifications(prev => append ? [...prev, ...rows] : rows)
      offsetRef.current = offset + rows.length
    }

    setLoading(false)
  }, [userId])

  // ── Fetch unread count ─────────────────────────────────────────────────

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false)

    setUnreadCount(count ?? 0)
  }, [userId])

  // ── Fetch preferences ──────────────────────────────────────────────────

  const fetchPreferences = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (data) setPreferences(data as NotificationPreferences)
  }, [userId])

  // ── Initial load ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    fetchNotifications(0, false)
    fetchUnreadCount()
    fetchPreferences()

    // Check push subscription state
    isSubscribedToPush().then(setPushSubscribed)
  }, [userId, fetchNotifications, fetchUnreadCount, fetchPreferences])

  // ── Realtime subscription for new notifications ────────────────────────

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications(prev => [newNotif, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // ── Listen for notification clicks from the service worker ─────────────

  useEffect(() => {
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
              setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
              )
              setUnreadCount(prev => Math.max(0, prev - 1))
            })
        }
        // Navigate if the app is open — dispatch event so Home can handle
        // without a full page reload
        if (url) {
          const parsed = new URL(url, window.location.origin)
          const photoId = parsed.searchParams.get('photo')
          const reviewId = parsed.searchParams.get('review')
          const commentId = parsed.searchParams.get('comment')
          if (photoId || reviewId) {
            window.dispatchEvent(new CustomEvent('push-deep-link', {
              detail: { photoId, reviewId, commentId },
            }))
          } else if (url !== window.location.pathname + window.location.search) {
            window.location.href = url
          }
        }
      }

      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGE') {
        // Re-register the new subscription
        if (userId) {
          subscribeToPush(userId).then(result => {
            setPushSubscribed(result.success)
          })
        }
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleMessage)
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage)
    }
  }, [userId])

  // ── Actions ────────────────────────────────────────────────────────────

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', userId)
      .eq('read', false)
  }, [userId])

  const loadMore = useCallback(async () => {
    if (!hasMore) return
    await fetchNotifications(offsetRef.current, true)
  }, [hasMore, fetchNotifications])

  const enablePush = useCallback(async () => {
    if (!userId) return { success: false, error: 'Not logged in.' }
    const result = await subscribeToPush(userId)
    if (result.success) {
      setPushSubscribed(true)
      // Ensure preferences have enabled = true
      await supabase
        .from('notification_preferences')
        .upsert({ user_id: userId, enabled: true }, { onConflict: 'user_id' })
      fetchPreferences()
    }
    return result
  }, [userId, fetchPreferences])

  const disablePush = useCallback(async () => {
    if (!userId) return
    await unsubscribeFromPush(userId)
    setPushSubscribed(false)
  }, [userId])

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!userId) return
    const { data } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
      .select()
      .maybeSingle()

    if (data) setPreferences(data as NotificationPreferences)
  }, [userId])

  const refreshPreferences = fetchPreferences

  return {
    notifications,
    unreadCount,
    loading,
    preferences,
    pushSupported,
    pushSubscribed,
    pushPermission,
    markRead,
    markAllRead,
    loadMore,
    hasMore,
    enablePush,
    disablePush,
    updatePreferences,
    refreshPreferences,
  }
}

// Re-export triggerPushDelivery for use by other hooks
export { triggerPushDelivery }
