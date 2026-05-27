// ═══════════════════════════════════════════════
//  SLAPCHAT SERVICE WORKER v5
// ═══════════════════════════════════════════════
const CACHE = 'slapchat-v5';
const BASE  = self.registration.scope;

const SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

// INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        SHELL.map(url =>
          fetch(url, { cache: 'no-cache' })
            .then(r => { if (r.ok) cache.put(url, r); })
            .catch(() => {})
        )
      )
    )
  );
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Skip non-http requests (chrome-extension, data:, blob: etc)
  if (!url.startsWith('http')) return;

  // Never intercept Firebase / Google auth APIs
  if (
    url.includes('firebaseio.com') ||
    url.includes('firebaseapp.com') ||
    url.includes('identitytoolkit') ||
    url.includes('securetoken') ||
    url.includes('googleapis.com') ||
    url.includes('gstatic.com') ||
    url.includes('firebasestorage')
  ) {
    return; // Let browser handle — no respondWith
  }

  // Navigation requests — network first, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            // Clone BEFORE any consumption
            const toCache = response.clone();
            caches.open(CACHE).then(c => c.put(event.request, toCache));
          }
          return response;
        })
        .catch(() =>
          caches.match(BASE + 'index.html')
            .then(r => r || caches.match(BASE))
        )
    );
    return;
  }

  // Static assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (response && response.ok && response.type !== 'opaque') {
            // Clone BEFORE returning — critical fix for "body already used" error
            const toCache = response.clone();
            caches.open(CACHE).then(c => c.put(event.request, toCache));
          }
          return response;
        })
        .catch(() => new Response('Offline', { status: 503 }));
    })
  );
});
