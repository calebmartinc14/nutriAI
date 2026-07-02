const CACHE = 'nutveo-v1'

const PRECACHE = [
  '/',
  '/css/styles.css',
  '/icon.svg',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Solo interceptamos peticiones del mismo origen
  if (url.origin !== location.origin) return
  // No cacheamos llamadas API
  if (url.pathname.startsWith('/api/')) return
  // Solo cacheamos GET
  if (request.method !== 'GET') return

  // Assets estáticos: cache-first
  if (/\.(js|css|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(request))
    return
  }

  // Navegación / HTML: network-first con fallback a cache
  if (request.mode === 'navigate') {
    e.respondWith(networkFirst(request))
    return
  }

  // Otros: network-only
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res.ok) {
    const cache = await caches.open(CACHE)
    cache.put(request, res.clone())
  }
  return res
}

async function networkFirst(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const cache = await caches.open(CACHE)
      cache.put(request, res.clone())
    }
    return res
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response('Sin conexión', { status: 503 })
  }
}
