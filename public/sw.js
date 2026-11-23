// Offline support (US-31). Same-origin app files: cache-first after first load (navigations: network-first).
// MapAnt WMS images: stale-while-revalidate in a size-limited cache. Overpass POSTs are never cached here
// (OSM data is cached in IndexedDB by the app).
const APP = 'korttelit-app-v1';
const TILES = 'korttelit-tiles-v1';
const MAX_TILES = 600;

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(APP).then((c) => c.addAll(['./', './index.html', './icon.svg', './manifest.webmanifest']).catch(() => undefined))); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== APP && k !== TILES) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('mapant.fi')) {
    e.respondWith((async () => {
      const cache = await caches.open(TILES);
      const hit = await cache.match(req);
      const net = fetch(req).then((r) => { if (r.ok && r.type !== 'opaque') { cache.put(req, r.clone()).then(() => trim(cache)); } return r; }).catch(() => undefined);
      return hit ?? (await net) ?? Response.error();
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const c = r.clone(); caches.open(APP).then((cc) => cc.put('./index.html', c)); return r; }).catch(async () => (await caches.match('./index.html')) ?? Response.error()));
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const r = await fetch(req);
    if (r.ok) { const c = r.clone(); caches.open(APP).then((cc) => cc.put(req, c)); }
    return r;
  })());
});
