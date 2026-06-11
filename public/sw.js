const CACHE_NAME = 'severino-financeiro-v5'
const APP_SHELL = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/icons/pwa-app-icon.png',
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

/** Guarda a resposta no cache se for cacheável (200, mesma origem). Best-effort. */
function putInCache(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    const clone = response.clone()
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // HTML / navegação: network-first (deploy novo é pego na hora) + fallback offline.
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

  // O próprio service worker: sempre da rede (jamais servir um SW velho do cache).
  if (url.pathname === '/sw.js') {
    return
  }

  // Assets versionados pelo Vite (/assets/*-<hash>.js|css): o nome muda quando o
  // conteúdo muda, logo são imutáveis → CACHE-FIRST. Reabrir o app não toca a
  // rede para o shell JS/CSS; o index.html (navigate, network-first) referencia
  // sempre os hashes atuais, então deploy novo nunca fica preso em asset velho.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => putInCache(request, res))
      )
    )
    return
  }

  // Demais estáticos (ícones, manifest, fontes): stale-while-revalidate — responde
  // do cache na hora e atualiza em background para a próxima visita.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => putInCache(request, res))
        .catch(() => cached || new Response('Network error and no cache available', { status: 503 }))
      return cached || network
    })
  )
})
