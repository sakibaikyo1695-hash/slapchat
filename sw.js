// ═══════════════════════════════════════════════
//  SLAPCHAT — SERVICE WORKER
//  Bump version string below to force cache refresh
// ═══════════════════════════════════════════════
const CACHE_NAME = 'slapchat-v3';
const SCOPE      = '/slapchat/';   // ← your GitHub Pages subpath

const SHELL_FILES = [
  SCOPE,
  SCOPE + 'index.html',
  SCOPE + 'manifest.json',
  SCOPE + 'icon-192.png',
  SCOPE + 'icon-512.png',
  SCOPE + 'sw.js',
];

// ── INSTALL — pre-cache shell ───────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll fails if ANY file 404s — add individually so one bad file doesn't break everything
      return Promise.allSettled(
        SHELL_FILES.map(url => cache.add(url).catch(e => console.warn('Cache miss:', url, e)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — remove old caches ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — network-first for Firebase, cache-first for shell ──
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ── Always network for Firebase & external APIs ──
  const networkOnly = [
    'firebaseio.com',
    'firebaseapp.com',
    'identitytoolkit.googleapis.com',
    'securetoken.googleapis.com',
    'firebasestorage.googleapis.com',
    'gstatic.com',
  ];
  if (networkOnly.some(h => url.hostname.includes(h))) {
    // Don't intercept — let browser handle directly
    return;
  }

  // ── Google Fonts — network with cache fallback ──
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // ── App shell — cache-first, network fallback ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return the cached app shell for navigation requests
        if (event.request.destination === 'document') {
          return caches.match(SCOPE + 'index.html')
              || caches.match(SCOPE);
        }
      });
    })
  );
});
