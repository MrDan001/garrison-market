// Service worker for Garrison Market.
//
// Two jobs:
// 1. Satisfy PWA install criteria (see PwaServiceWorkerRegister.tsx) via
//    the install/activate/fetch handlers below.
// 2. Show OS-level notifications when a push arrives from the server —
//    this is what makes notifications appear even when the app is closed
//    or in the background, the same as a native app.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// --- Push notifications -------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Garrison Market', body: event.data.text() };
  }

  const title = payload.title || 'Garrison Market';
  const options = {
    body: payload.body || '',
    icon: '/icon-192x192.png',
    badge: '/badge-192x192.png',
    tag: payload.tag || 'garrison-market-notification',
    renotify: true,
    data: { link: payload.link || '/' },
    // Android groups/collapses same-tag notifications by default; this
    // keeps the vibration/sound firing for each new one instead of the
    // second+ notification arriving silently.
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the OS notification: focus an already-open tab on this origin
// if one exists (and hand it the link so it can navigate client-side),
// otherwise open a fresh tab at the link.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = event.notification.data?.link || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of allClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin) {
          client.postMessage({ type: 'notification-click', link });
          return client.focus();
        }
      }

      return self.clients.openWindow(link);
    })()
  );
});

// --- Subscription rotation ----------------------------------------------
//
// The browser (Chrome/FCM especially) can invalidate or rotate a push
// subscription entirely on its own — not from anything the app or user
// did. When that happens this event fires, and if nothing here
// re-subscribes, the device just silently stops receiving pushes: the
// permission still shows "granted" in Settings, so nothing looks wrong
// until you notice notifications quietly stopped. This mirrors the
// subscribe flow in hooks/usePushNotifications.ts, since a service
// worker can't import that hook or call a server action directly.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const oldEndpoint = event.oldSubscription ? event.oldSubscription.endpoint : null;

        let applicationServerKey = event.oldSubscription && event.oldSubscription.options
          ? event.oldSubscription.options.applicationServerKey
          : null;

        if (!applicationServerKey) {
          const res = await fetch('/api/push/vapid-key');
          const { key } = await res.json();
          if (!key) throw new Error('No VAPID public key available');
          applicationServerKey = urlBase64ToUint8Array(key);
        }

        const newSubscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        await fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint,
            subscription: newSubscription.toJSON(),
            userAgent: self.navigator ? self.navigator.userAgent : null,
          }),
        });
      } catch (err) {
        // Nothing more we can do from inside the service worker — the
        // device stays unsubscribed until the user reopens the app,
        // where usePushNotifications' own getSubscription() check will
        // find nothing active and show "Enable Notifications" again.
        console.error('[sw] pushsubscriptionchange handling failed', err);
      }
    })()
  );
});