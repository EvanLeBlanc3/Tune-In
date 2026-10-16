/* Tune In service worker — caches the app so it runs offline. Bump VERSION when you update files. */
const VERSION = 'tunein-v1.0.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './css/style.css',
  './js/themes.js', './js/db.js', './js/tags.js', './js/engine.js', './js/sfx.js', './js/viz.js', './js/demo.js', './js/app.js', './js/ui.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol === 'blob:' || url.protocol === 'data:') return;
  // Fonts: cache-first, saved after first online launch
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => hit))));
    return;
  }
  if (url.origin !== location.origin) return;
  // App files: cache-first, refresh in background
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; }).catch(() => hit || caches.match('./index.html'));
    return hit || net;
  }));
});
