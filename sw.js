// ═══════════════════════════════════════════════
//  SLAPCHAT — SERVICE WORKER
//  Version: bump this string to force cache refresh
// ═══════════════════════════════════════════════
const CACHE_NAME = 'slapchat-v1';

// Files to cache for offline shell
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  // Google Fonts (cached on first load)
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Orbitron:wght@400;700&display=swap'
];

// ── INSTALL — cache the app shell ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE — clean up old caches ─────────────
self.addEventListener('activate', event => {
  event.waitUntil(
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

// ── FETCH — serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for Firebase (real-time data must be live)
  if (
    url.hostname.includes('firebaseio.com')     ||
    url.hostname.includes('firebaseapp.com')    ||
    url.hostname.includes('googleapis.com')     ||
    url.hostname.includes('gstatic.com')        ||
    url.hostname.includes('firebasestorage')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (app shell, fonts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid responses for future offline use
        if (
          response &&
          response.status === 200 &&
          response.type !== 'opaque'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If completely offline and not cached, return the app shell
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
