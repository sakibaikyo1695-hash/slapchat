// ═══════════════════════════════════════════════
//  SLAPCHAT SERVICE WORKER v6
// ═══════════════════════════════════════════════
const CACHE = 'slapchat-v6';
const BASE  = self.registration.scope;

const SHELL = [
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

// INSTALL — cache shell files
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        SHELL.map(url =>
          fetch(url, { cache: 'reload' })
            .then(r => { if (r && r.ok) return cache.put(url, r); })
            .catch(() => {})
        )
      )
    )
  );
});

// ACTIVATE — delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Skip non-http (chrome-extension, data:, blob:)
  if (!url.startsWith('http')) return;

  // Never intercept Firebase / Google auth — must always be live
  if (
    url.includes('firebaseio.com')       ||
    url.includes('firebaseapp.com')      ||
    url.includes('identitytoolkit')      ||
    url.includes('securetoken')          ||
    url.includes('googleapis.com')       ||
    url.includes('gstatic.com')          ||
    url.includes('firebasestorage')
  ) {
    return;
  }

  // Navigation — network first, cache fallback for offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(BASE + 'index.html')
        )
    );
    return;
  }

  // Assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request)
        .then(response => {
          if (response && response.ok && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => new Response('Offline', { status: 503 }));
    })
  );
});
