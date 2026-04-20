// ============================================================
//  VICTORY AUTO SALES — SERVICE WORKER
//  Enables offline mode + "Add to Home Screen" on iOS/Android
// ============================================================
const CACHE_NAME = 'vas-crm-v1';
const CORE_ASSETS = [
  '/lead-tracker.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// On install: cache the shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// On activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// On fetch: network-first for API, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for API and webhooks
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhook')) {
    return; // bypass service worker entirely
  }

  // For everything else: try network, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
