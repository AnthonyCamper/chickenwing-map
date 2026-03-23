// ============================================================================
// Push subscription management utilities
// ============================================================================

import { supabase } from './supabase'

// VAPID public key — this is NOT a secret. It identifies the application server
// to push services. The corresponding private key is a Supabase Edge Function secret.
// Regenerate with: node scripts/generate-vapid-keys.js
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  || 'BJZJMvCa9GcMaNnvTafqOUHr2wPeXGBi1ZYNQH1EMRpypb1X_zk0ET_w8brgrwePx_E-H7-W4rrhQ7aUyOYH5SY'

// ── Feature detection ────────────────────────────────────────────────────────

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/**
 * On iOS 16.4+, push notifications only work in standalone (Home Screen) mode.
 * Returns true if we're on iOS but NOT in standalone mode.
 */
export function needsHomeScreenInstall(): boolean {
  return isIOS() && !isStandalone()
}

export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

// ── Service worker lifecycle helpers ─────────────────────────────────────────

let swRegistration: ServiceWorkerRegistration | null = null

/**
 * Wait for a ServiceWorker to reach the 'activated' state, with timeout.
 */
function waitForWorkerActivation(worker: ServiceWorker, timeoutMs = 10_000): Promise<void> {
  if (worker.state === 'activated') return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.removeEventListener('statechange', onStateChange)
      reject(new Error(`Service worker stuck in "${worker.state}" state after ${timeoutMs}ms`))
    }, timeoutMs)

    const onStateChange = () => {
      if (worker.state === 'activated') {
        clearTimeout(timer)
        worker.removeEventListener('statechange', onStateChange)
        resolve()
      } else if (worker.state === 'redundant') {
        clearTimeout(timer)
        worker.removeEventListener('statechange', onStateChange)
        reject(new Error('Service worker became redundant during activation'))
      }
    }

    worker.addEventListener('statechange', onStateChange)
    // Re-check after attaching listener to avoid missed transition
    if (worker.state === 'activated') {
      clearTimeout(timer)
      worker.removeEventListener('statechange', onStateChange)
      resolve()
    } else if (worker.state === 'redundant') {
      clearTimeout(timer)
      worker.removeEventListener('statechange', onStateChange)
      reject(new Error('Service worker became redundant during activation'))
    }
  })
}

/**
 * Wait for a registration to be fully settled: active worker in 'activated'
 * state with no pending updates. Handles skipWaiting() transitions.
 */
async function waitUntilSettled(reg: ServiceWorkerRegistration): Promise<void> {
  // If there's a pending worker (installing/waiting), it will replace the
  // active worker via skipWaiting(). Wait for it to fully activate.
  const pending = reg.installing || reg.waiting
  if (pending) {
    console.debug('[Push] Waiting for pending worker (%s) to activate', pending.state)
    await waitForWorkerActivation(pending)
    // Chrome's internal push manager state lags behind the SW state.
    // Give it time to settle after a skipWaiting() transition.
    await new Promise(r => setTimeout(r, 200))
    return
  }

  // Active worker exists but not yet fully activated
  if (reg.active && reg.active.state !== 'activated') {
    console.debug('[Push] Waiting for active worker (%s) to finish activating', reg.active.state)
    await waitForWorkerActivation(reg.active)
    await new Promise(r => setTimeout(r, 200))
    return
  }

  // Fully settled — no pending updates, active worker is activated
}

// ── Eager SW registration ────────────────────────────────────────────────────
// Register the service worker as early as possible (module load) so that
// by the time a user enables push notifications, the SW is fully activated
// and settled. This decouples the SW lifecycle from the subscribe() call,
// eliminating the race where register() → skipWaiting() → AbortError.

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(reg => {
      swRegistration = reg
      console.debug('[Push] SW registered eagerly, state:', reg.active?.state ?? 'no active worker')
    })
    .catch(err => console.warn('[Push] Eager SW registration failed:', err))
}

/**
 * Get a fully settled service worker registration, ready for pushManager
 * operations. Uses navigator.serviceWorker.ready (which does NOT trigger
 * an update check) rather than register() (which does).
 */
async function getSettledRegistration(): Promise<ServiceWorkerRegistration> {
  // navigator.serviceWorker.ready resolves when there IS an active worker.
  // It does NOT trigger an update check, so it won't cause skipWaiting()
  // to fire during our subscribe call. The eager registration on module load
  // ensures a SW will eventually become active.
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(resolve => setTimeout(() => resolve(null), 8_000)),
  ])

  if (!reg) {
    // Eager registration may not have completed — register now as fallback
    console.warn('[Push] navigator.serviceWorker.ready timed out, registering now')
    const freshReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await waitUntilSettled(freshReg)
    // Extra settle time after a fresh registration (skipWaiting race window)
    await new Promise(r => setTimeout(r, 300))
    swRegistration = freshReg
    return freshReg
  }

  // Ensure any in-progress update has fully settled before we touch pushManager
  await waitUntilSettled(reg)
  swRegistration = reg
  return reg
}

/**
 * Force a clean SW re-registration — unregisters existing SW (clearing
 * Chrome's internal push database for this scope) then registers fresh.
 * Used as last resort for SENDER_ID_MISMATCH / persistent AbortError.
 */
async function forceCleanRegistration(): Promise<ServiceWorkerRegistration> {
  // Unregister all existing SWs for this scope
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) {
    try {
      const stale = await existing.pushManager.getSubscription()
      if (stale) await stale.unsubscribe()
    } catch { /* safe to ignore */ }
    await existing.unregister()
  }
  swRegistration = null

  // Let browser fully clean up before re-registering
  await new Promise(r => setTimeout(r, 500))

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await waitUntilSettled(reg)
  // Generous settle time after a clean re-registration
  await new Promise(r => setTimeout(r, 500))
  swRegistration = reg
  return reg
}

// Keep for external use (e.g. useNotifications initial load)
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await getSettledRegistration()
  } catch (err) {
    console.error('[Push] Service worker registration failed:', err)
    return null
  }
}

export function getRegistration(): ServiceWorkerRegistration | null {
  return swRegistration
}

// ── VAPID key conversion ─────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ── Error classification ─────────────────────────────────────────────────────

function classifyPushError(err: unknown): string {
  if (!(err instanceof Error)) return 'An unexpected error occurred while enabling push notifications.'

  const msg = err.message.toLowerCase()
  const name = err.name

  // DOMException from pushManager.subscribe()
  if (name === 'NotAllowedError') {
    return 'Notification permission was denied. You can re-enable it in your browser settings.'
  }
  if (name === 'InvalidStateError') {
    return 'Push is already active on another subscription. Try refreshing the page.'
  }
  if (name === 'AbortError' || msg.includes('abort')) {
    return 'Push setup was interrupted. Please try again.'
  }

  // Service worker stuck or timed out
  if (msg.includes('stuck in') || msg.includes('timed out') || msg.includes('redundant')) {
    return 'The notification service worker failed to activate. Please try again.'
  }

  // Chrome-specific push service errors (FCM connectivity / key rejection)
  if (msg.includes('push service') || msg.includes('registration failed')) {
    return 'Could not reach the push notification service. Check your internet connection and try again.'
  }

  // Invalid VAPID key
  if (msg.includes('application server key') || msg.includes('applicationserverkey')) {
    return 'Push notification configuration error. Please contact the app administrator.'
  }

  // Network / fetch failures during subscription
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    return 'Network error during push setup. Check your connection and try again.'
  }

  // Fallback — include the original message for diagnostics
  console.error('[Push] Unclassified subscribe error:', err)
  return 'Could not enable push notifications. Please try again.'
}

// ── Subscribe to push ────────────────────────────────────────────────────────

export async function subscribeToPush(userId: string): Promise<{
  success: boolean
  error?: string
  needsInstall?: boolean
}> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported in this browser.' }
  }

  if (needsHomeScreenInstall()) {
    return {
      success: false,
      error: 'On iPhone, notifications require adding this app to your Home Screen first.',
      needsInstall: true,
    }
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VAPID_PUBLIC_KEY is not set')
    return { success: false, error: 'Push notifications are not configured on this server.' }
  }

  // Validate VAPID key format before attempting subscribe
  let applicationServerKey: Uint8Array
  try {
    applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    // P-256 uncompressed public key = 65 bytes (0x04 prefix + 32-byte X + 32-byte Y)
    if (applicationServerKey.length !== 65) {
      console.error('[Push] VAPID key is wrong length:', applicationServerKey.length, '(expected 65)')
      return { success: false, error: 'Push notification configuration error (invalid server key).' }
    }
  } catch (e) {
    console.error('[Push] Failed to decode VAPID key:', e)
    return { success: false, error: 'Push notification configuration error (malformed server key).' }
  }

  // Request permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return {
      success: false,
      error: permission === 'denied'
        ? 'Notification permission was denied. You can re-enable it in your browser settings.'
        : 'Notification permission was dismissed. Try again when you\'re ready.',
    }
  }

  // Get a settled SW registration. Uses navigator.serviceWorker.ready which
  // does NOT trigger an update (unlike register()), avoiding the skipWaiting()
  // → AbortError race that caused the original bug.
  let reg: ServiceWorkerRegistration
  try {
    reg = await getSettledRegistration()
  } catch (swErr) {
    console.error('[Push] Service worker setup failed:', swErr)
    return { success: false, error: 'Could not set up the notification service worker.' }
  }

  // Get or create push subscription
  const subscribeOptions: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    // Pass Uint8Array directly — do NOT extract .buffer, which can produce
    // a detached or misinterpreted ArrayBuffer in some browser versions.
    applicationServerKey: applicationServerKey as unknown as BufferSource,
  }

  let subscription: PushSubscription
  try {
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      subscription = existing
    } else {
      // Double-check settlement right before the most race-sensitive call
      await waitUntilSettled(reg)
      subscription = await reg.pushManager.subscribe(subscribeOptions)
    }
  } catch (err) {
    // AbortError after getSettledRegistration = likely SENDER_ID_MISMATCH
    // (Chrome/FCM cached a previous VAPID key for this scope). Or an update
    // snuck in between our settlement check and subscribe(). Try once more
    // after waiting for any pending update to finish.
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'InvalidStateError')) {
      console.warn('[Push] subscribe() threw %s — retrying after settlement wait', err.name)
      try {
        // Wait for any in-flight update, then retry
        await waitUntilSettled(reg)
        await new Promise(r => setTimeout(r, 500))
        subscription = await reg.pushManager.subscribe(subscribeOptions)
      } catch (retryErr) {
        // Still failing — escalate to full clean re-registration
        if (retryErr instanceof DOMException && (retryErr.name === 'AbortError' || retryErr.name === 'InvalidStateError')) {
          console.warn('[Push] Retry also failed (%s) — forcing clean SW re-registration', retryErr.name)
          try {
            const cleanReg = await forceCleanRegistration()
            subscription = await cleanReg.pushManager.subscribe(subscribeOptions)
          } catch (cleanErr) {
            console.error('[Push] Clean re-registration also failed:', cleanErr)
            return { success: false, error: classifyPushError(cleanErr) }
          }
        } else {
          console.error('[Push] pushManager.subscribe() retry failed:', retryErr)
          return { success: false, error: classifyPushError(retryErr) }
        }
      }
    } else {
      console.error('[Push] pushManager.subscribe() failed:', err)
      return { success: false, error: classifyPushError(err) }
    }
  }

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    console.error('[Push] Subscription missing required fields:', JSON.stringify(json))
    return { success: false, error: 'Browser returned an incomplete push subscription.' }
  }

  // Store in database
  const { error: dbError } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      },
      { onConflict: 'user_id,endpoint' }
    )

  if (dbError) {
    console.error('[Push] Failed to save subscription:', dbError)
    return { success: false, error: 'Could not save your push subscription. Please try again.' }
  }

  return { success: true }
}

// ── Unsubscribe from push ────────────────────────────────────────────────────

export async function unsubscribeFromPush(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const reg = swRegistration || await navigator.serviceWorker?.getRegistration()
    if (reg) {
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        // Remove from database first
        await supabase
          .from('push_subscriptions')
          .delete()
          .match({ user_id: userId, endpoint: subscription.endpoint })

        // Then unsubscribe from the browser
        await subscription.unsubscribe()
      }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unsubscribe.',
    }
  }
}

// ── Check if currently subscribed ────────────────────────────────────────────

export async function isSubscribedToPush(): Promise<boolean> {
  try {
    const reg = swRegistration || await navigator.serviceWorker?.getRegistration()
    if (!reg) return false
    const subscription = await reg.pushManager.getSubscription()
    return !!subscription
  } catch {
    return false
  }
}

// ── Trigger push delivery for pending notifications ──────────────────────────

export async function triggerPushDelivery(notificationIds?: string[]): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const functionUrl = `${supabaseUrl}/functions/v1/send-push`

    fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ notification_ids: notificationIds }),
    }).catch(() => {
      // Fire-and-forget — push delivery failure is non-fatal
    })
  } catch {
    // Ignore errors — push is best-effort
  }
}
