const CACHE = 'translateocr-static-v1';
const STATIC = [
  '/style.css', '/i18n.js', '/app.js', '/connection.js', '/queue.js',
  '/review.js', '/workspace.js', '/inspector.js', '/workflow.js',
  '/studio.js', '/install.js', '/manifest.webmanifest',
  '/icons/icon-180.png', '/icons/icon-192.png', '/icons/icon-512.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('translateocr-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;
  if (STATIC.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
  }
  // The app document and every API request stay network-only. In particular,
  // no uploads, sessions, workspace data, generated documents, or auth are cached.
});
