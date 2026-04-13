const CACHE_NAME = 'horizonte-financeiro-v7'
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/images/horizonte_fiel_original_icon_dark.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = self.location.origin + '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus()
        }
      }
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
      return undefined
    })
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    )
    return
  }

  if (url.origin !== self.location.origin) {
    return
  }

  // API (Hono + Supabase): nunca cachear no SW — senão o PWA mostra dados velhos ou falha a “puxar” o utilizador.
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
    )
    return
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
        }

        return networkResponse
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        return new Response('Network error and no cache available', { status: 503 })
      })
  )
})
