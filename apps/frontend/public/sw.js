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
      badge: '/icon-192x192.png',
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