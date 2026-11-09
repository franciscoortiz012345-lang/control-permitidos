// Service worker de Control de Permitidos.
// Siempre trae la versión más nueva de internet; si no hay conexión, usa la copia guardada.
const CACHE = 'permitidos-v2';
const BASICOS = ['./', './index.html', './app.js', './config.js', './permitidos.css', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return; // los datos nunca se guardan en caché
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && (url.origin === location.origin || /cdn\.jsdelivr\.net/.test(url.hostname))) {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
