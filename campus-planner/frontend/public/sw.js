// Offline support. Only PUBLIC routine data is cached; sign-in, CGPA and admin calls never are.
const SHELL = 'cp-shell-v3', DATA = 'cp-data-v3'
const PUBLIC_API = ['/api/routine', '/api/notices']  // prefix match (stream and .ics are excluded below)

self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/theme-init.js'])).then(() => self.skipWaiting())) })
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

async function networkFirst(req, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(fallbackKey || req, res.clone())
    return res
  } catch (err) {
    const hit = await cache.match(fallbackKey || req)
    if (hit) return hit
    throw err
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) {
    const cacheable = PUBLIC_API.some((p) => url.pathname.startsWith(p)) &&
      !url.pathname.endsWith('/stream') && !url.pathname.endsWith('.ics')
    if (cacheable) e.respondWith(networkFirst(req, DATA))
    return
  }
  if (req.mode === 'navigate') e.respondWith(networkFirst(req, SHELL, '/'))
  else if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.open(SHELL).then(async (c) => (await c.match(req)) || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r })))
  }
})
