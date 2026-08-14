// A simple service worker to satisfy PWA install requirements.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // We don't cache anything in this simple SW, just let network handle it
  e.respondWith(fetch(e.request));
});
