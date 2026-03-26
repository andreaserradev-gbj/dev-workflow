// Dev Dashboard Service Worker
// Offline fallback only — all other requests go straight to network so
// dashboard updates are picked up immediately (Vite hashed filenames
// handle browser caching).
const CACHE_NAME = 'dev-dashboard-v1';
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_PAGE, '/icons/icon.svg'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept navigation requests for the offline fallback
  if (event.request.mode !== 'navigate') return;

  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_PAGE)));
});
