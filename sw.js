// ═══════════════════════════════════════════════
//  SLAPCHAT SERVICE WORKER v4
// ═══════════════════════════════════════════════
const CACHE = 'slapchat-v4';

// Detect base path dynamically
const BASE = self.registration.scope; // e.g. https://user.github.io/slapchat/

const SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
];

// INSTALL — cache shell files one by one (don't fail if one is missing)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(SHELL.map(url =>
        fetch(url).then(r => {
          if (r.ok) return cache.put(url, r);
        }).catch(() => {})
      ))
    )
  );
});

// ACTIVATE — delete old caches
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

  // Never intercept Firebase or Google APIs — must always be live
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

  // For navigation (page load) — network first, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(r => {
          // Cache fresh copy
          if (r && r.ok) {
            caches.open(CACHE).then(c => c.put(event.request, r.clone()));
          }
          return r;
        })
        .catch(() =>
          // Offline — serve cached index
          caches.match(BASE + 'index.html')
            .then(r => r || caches.match(BASE))
        )
    );
    return;
  }

  // For assets — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(r => {
        if (r && r.ok && r.type !== 'opaque') {
          caches.open(CACHE).then(c => c.put(event.request, r.clone()));
        }
        return r;
      }).catch(() => new Response('', { status: 408 }));
    })
  );
});
