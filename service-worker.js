const CACHE_NAME = 'savemyphone-v3';
const assets = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js'
];

// Install service worker
self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      cache.addAll(assets);
    })
  );
  self.skipWaiting();
});

// Activate and clean old caches
self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch events
self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;

  const requestUrl = new URL(evt.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isNavigation = evt.request.mode === 'navigate';
  if (isNavigation) {
    // For page navigation, prefer fresh network response so UI updates immediately.
    evt.respondWith(
      fetch(evt.request)
        .then(networkRes => {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
          return networkRes;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (isSameOrigin) {
    // For local assets (app.js, manifest, icons), prefer latest network content.
    evt.respondWith(
      fetch(evt.request)
        .then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(evt.request, copy));
          }
          return networkRes;
        })
        .catch(() => caches.match(evt.request))
    );
    return;
  }

  evt.respondWith(
    caches.match(evt.request).then(cacheRes => {
      if (cacheRes) return cacheRes;
      return fetch(evt.request);
    })
  );
});
