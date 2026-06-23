// sw.js — minimal offline-first service worker.
// Bump CACHE when you ship changes so clients pull the new files.
const CACHE = 'rep-v1';
const ASSETS = [
  '.', 'index.html',
  'css/styles.css',
  'js/data.js', 'js/state.js', 'js/algorithm.js', 'js/ui.js', 'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for our own assets, network fallback; navigations fall back to index.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => request.mode === 'navigate' ? caches.match('index.html') : undefined);
    })
  );
});
