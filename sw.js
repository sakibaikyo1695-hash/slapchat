// ═══════════════════════════════════════════════
//  SLAPCHAT SERVICE WORKER v8
//  CRITICAL: Caches Firebase SDK scripts so app
//  works completely offline after first load
// ═══════════════════════════════════════════════
const CACHE = 'slapchat-v8';
const BASE  = self.registration.scope;

// ALL files needed to run the app offline
// Including Firebase SDK from gstatic (critical!)
const SHELL = [
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  // Firebase SDK scripts — MUST be cached for offline
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Orbitron:wght@400;700&display=swap',
];

// INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(
        SHELL.map(url =>
          fetch(url, { cache: 'no-cache' })
            .then(r => {
              if (r && r.ok) {
                return cache.put(url, r);
              }
            })
            .catch(e => console.log('Cache miss (will retry):', url))
        )
      )
    )
  );
});

// ACTIVATE
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
  if (!url.startsWith('http')) return;

  // Firebase REALTIME DATA — never cache, always live
  // (auth tokens, database reads/writes must be fresh)
  if (
    url.includes('firebaseio.com')   ||
    url.includes('identitytoolkit')  ||
    url.includes('securetoken')      ||
    url.includes('firebasestorage')
  ) return;

  // Firebase AUTH app check — pass through
  if (url.includes('firebaseapp.com') && url.includes('/__/auth/')) return;

  // EVERYTHING ELSE: cache-first (SDK, app shell, fonts, icons)
  // This includes gstatic.com Firebase SDK files
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache, update in background
        fetch(event.request)
          .then(r => {
            if (r && r.ok) {
              caches.open(CACHE).then(c => c.put(event.request, r));
            }
          }).catch(() => {});
        return cached;
      }
      // Not in cache — fetch and cache it
      return fetch(event.request).then(r => {
        if (r && r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return r;
      }).catch(() => {
        // Offline and not cached — for navigation return cached index
        if (event.request.mode === 'navigate') {
          return caches.match(BASE + 'index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
