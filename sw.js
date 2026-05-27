// ═══════════════════════════════════════════════
//  SLAPCHAT SERVICE WORKER v7
//  Caches the app shell so it loads even when offline
// ═══════════════════════════════════════════════
const CACHE = 'slapchat-v7';
const BASE  = self.registration.scope;

const SHELL = [
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

// INSTALL — cache every shell file individually
// Use no-cache fetch so we always get fresh files on install
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        SHELL.map(url =>
          fetch(url, { cache: 'no-cache' })
            .then(r => { if (r && r.ok) return cache.put(url, r); })
            .catch(() => {})
        )
      )
    )
  );
});

// ACTIVATE — remove old cache versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH — serve shell from cache, pass Firebase through
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Skip non-http (chrome-extension, data:, blob:)
  if (!url.startsWith('http')) return;

  // NEVER intercept Firebase, Google APIs — must always be live
  if (
    url.includes('firebaseio.com')      ||
    url.includes('firebaseapp.com')     ||
    url.includes('identitytoolkit')     ||
    url.includes('securetoken')         ||
    url.includes('googleapis.com')      ||
    url.includes('gstatic.com')         ||
    url.includes('firebasestorage')
  ) return;

  // Navigation (page load) — cache first, network fallback
  // This is what makes the app open offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(BASE + 'index.html').then(cached => {
        if (cached) {
          // Serve from cache immediately (offline works)
          // Also fetch fresh copy in background for next time
          fetch(event.request)
            .then(r => {
              if (r && r.ok) {
                caches.open(CACHE).then(c => c.put(event.request, r));
              }
            }).catch(() => {});
          return cached;
        }
        // Not cached yet — fetch from network
        return fetch(event.request).then(r => {
          if (r && r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone));
          }
          return r;
        });
      })
    );
    return;
  }

  // Static assets (icons, manifest) — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(r => {
        if (r && r.ok && r.type !== 'opaque') {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return r;
      }).catch(() => new Response('', { status: 503 }));
    })
  );
});
