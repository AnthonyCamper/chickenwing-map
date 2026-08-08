// ============================================================================
// Service Worker — Push notifications for WingMap
// ============================================================================

const APP_ORIGIN = self.location.origin

// ── Push event: show notification ────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = {
      title: 'WingMap',
      body: event.data.text(),
      data: { url: '/' },
    }
  }

  const { title, body, icon, badge, tag, data } = payload

  const options = {
    body: body || '',
    icon: icon || '/icons/icon-192.png',
    badge: badge || '/icons/icon-192.png',
    tag: tag || 'wingmap-' + Date.now(),
    data: {
      url: data?.url || '/',
      notificationId: data?.notificationId,
    },
    // Group notifications from the same source
    renotify: !!tag,
    // Vibrate on mobile
    vibrate: [100, 50, 100],
    // Keep notification until user interacts
    requireInteraction: false,
    actions: [],
  }

  event.waitUntil(self.registration.showNotification(title || 'WingMap', options))
})

// ── Notification click: deep link to correct screen ──────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'
  const fullUrl = new URL(url, APP_ORIGIN).href
  const notificationId = event.notification.data?.notificationId

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url === fullUrl && 'focus' in client) {
          return client.focus()
        }
      }

      // If any app window is open, navigate it
      for (const client of windowClients) {
        if (new URL(client.url).origin === APP_ORIGIN && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: url,
            notificationId: notificationId,
          })
          return client.focus()
        }
      }

      // Otherwise open a new window
      return clients.openWindow(fullUrl)
    })
  )
})

// ── Subscription change: resubscribe ─────────────────────────────────────────

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options || {
        userVisibleOnly: true,
      })
      .then((newSubscription) => {
        // Notify the app to update the subscription on the server
        return clients.matchAll({ type: 'window' }).then((windowClients) => {
          for (const client of windowClients) {
            client.postMessage({
              type: 'PUSH_SUBSCRIPTION_CHANGE',
              subscription: newSubscription.toJSON(),
              oldEndpoint: event.oldSubscription?.endpoint,
            })
          }
        })
      })
      .catch(() => {
        // Can't resubscribe — user will need to re-enable manually
      })
  )
})

// ── Install & activate ───────────────────────────────────────────────────────
// skipWaiting() forces the new service worker to activate immediately, which
// aborts any in-flight pushManager.subscribe() calls on the old registration
// (browser throws AbortError). We still call skipWaiting() so the latest SW
// takes over quickly, but the client-side code in pushManager.ts waits for
// the activation transition to settle before calling subscribe().

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})
