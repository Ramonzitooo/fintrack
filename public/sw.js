const CACHE_NAME = 'fintrack-v4-shell-1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
];
const LOCAL_API_BYPASS_PREFIXES = ['/health', '/actuator', '/danfse'];

function isLocalApiBypassPath(pathname) {
  const normalized = pathname.toLowerCase();
  return LOCAL_API_BYPASS_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

function createOfflineResponse() {
  return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(event.request.url);
  } catch {
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (isLocalApiBypassPath(requestUrl.pathname)) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match('./index.html'))
            .then((cached) => cached || caches.match('./'))
            .then((cached) => cached || createOfflineResponse())
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse || createOfflineResponse());

      return cachedResponse || fetchPromise;
    })
  );
});
