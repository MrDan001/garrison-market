// Minimal service worker for Garrison Market.
//
// Chrome/Edge/Android require an actively controlling service worker with a
// fetch handler before they will consider a site "installable" and fire the
// `beforeinstallprompt` event. This worker intentionally does NOT cache
// anything — it just passes every request straight through to the network.
// That keeps things safe for a live inventory/invoicing/payments app where
// stale cached data could show wrong stock, prices, or invoice totals.
//
// If offline support is wanted later, caching can be added here.

self.addEventListener('install', () => {
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });
  
  self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
  });