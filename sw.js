// Cache-first service worker. The app is fully static, so once this list is in
// the cache the app runs with the network switched off.
// PRECACHE is checked against the filesystem by test/precache.test.js, so adding
// a file without listing it here fails the build.

const VERSION = '2dc06ea388';
const CACHE = `climbers-elbow-${VERSION}`;

const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/protocol.js',
  'js/scheduler.js',
  'js/store.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'diagrams/eccentric-wrist-flexion-1.svg',
  'diagrams/eccentric-wrist-flexion-2.svg',
  'diagrams/finger-extensor-band-1.svg',
  'diagrams/finger-extensor-band-2.svg',
  'diagrams/isometric-holds-1.svg',
  'diagrams/isometric-holds-2.svg',
  'diagrams/pronator-lever-1.svg',
  'diagrams/pronator-lever-2.svg',
  'diagrams/reverse-tyler-twist-1.svg',
  'diagrams/reverse-tyler-twist-2.svg',
  'diagrams/reverse-tyler-twist-3.svg',
  'diagrams/reverse-tyler-twist-4.svg',
  'diagrams/reverse-wrist-curl-1.svg',
  'diagrams/reverse-wrist-curl-2.svg',
  'diagrams/shoulder-band-work-1.svg',
  'diagrams/shoulder-band-work-2.svg',
  'diagrams/wrist-flexor-stretch-1.svg',
  'diagrams/wrist-flexor-stretch-2.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // opaque and error responses are not worth caching
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          // a navigation with no network falls back to the cached shell
          req.mode === 'navigate' ? caches.match('index.html') : Response.error()
        );
    })
  );
});
