// Bumped whenever the fetch strategy changes: `activate` deletes every cache
// not in this set, which is how older clients drop rules that were wrong.
const CACHE_VERSION = "loop-social-v3.1"
const STATIC_CACHE = "loop-static-v3.1"
const DYNAMIC_CACHE = "loop-dynamic-v3.1"
const IMAGE_CACHE = "loop-images-v3.1"
const FONT_CACHE = "loop-fonts-v3.1"

// Static assets to cache immediately on install.
// NOTE: "/" is deliberately absent. Caching the home document meant a failed
// or slow navigation could render the home page at whatever URL the user
// asked for. Documents are network-only now; "/offline" is the fallback.
const PRECACHE_ASSETS = [
  "/offline",
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
]

// Routes that should be cached with stale-while-revalidate
const SWR_ROUTES = [
  "/api/search",
  "/api/circles",
  "/api/shop/items",
  "/api/ml/recommendations",
]

// Routes that should NEVER be cached
const NEVER_CACHE = [
  /^\/api\/auth/,
  /^\/api\/upload/,
  /^\/api\/payments/,
  /^\/api\/inventory/,
  /^\/api\/messages/,
  /^\/api\/notifications/,
  /^\/api\/users\/(?!suggestions)/,
  /^\/api\/admin/,
  /^\/api\/coins/,
  /^\/api\/gifts/,
  /^\/api\/boost/,
  /^\/api\/creator/,
]

// Font files to cache aggressively
const FONT_PATTERN = /\.(woff2?|ttf|otf|eot)(\?.*)?$/

// ─── Install ───────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...")
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log("[SW] Precaching assets")
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to precache ${url}:`, err.message)
          })
        )
      )
    })
  )
  // Activate immediately without waiting for old SW to die
  self.skipWaiting()
})

// ─── Activate ──────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...")
  event.waitUntil(
    Promise.all([
      // Delete all caches not in our version set
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => {
              return (
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE &&
                name !== IMAGE_CACHE &&
                name !== FONT_CACHE &&
                name !== CACHE_VERSION
              )
            })
            .map((name) => {
              console.log(`[SW] Deleting old cache: ${name}`)
              return caches.delete(name)
            })
        )
      ),
      self.clients.claim(),
    ])
  )
})

// ─── Fetch ─────────────────────────────────────────────────────────

/**
 * Next.js owns its own transport — never intercept it.
 *
 * The App Router "soft-navigates" by fetching an RSC payload for the target
 * route. When that request is answered from the Cache API the router cannot
 * trust the payload and falls back to a full document load — which is exactly
 * the "the whole app refreshed when I opened a page" symptom. Chunk and asset
 * requests must also reach the network so a stale entry can never surface as a
 * ChunkLoadError.
 */
function isNextInternal(request, url) {
  if (url.pathname.startsWith("/_next/")) return true
  if (url.pathname === "/sw.js") return true
  // RSC payload fetches and router prefetches, by header or by query param.
  if (request.headers.get("RSC")) return true
  if (request.headers.get("Next-Router-Prefetch")) return true
  if (request.headers.get("Next-Router-State-Tree")) return true
  if (url.searchParams.has("_rsc")) return true
  return false
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle GET requests and same-origin
  if (request.method !== "GET") return
  if (url.origin !== self.location.origin) return
  if (url.protocol === "chrome-extension:") return

  // Hand Next.js navigation data and build output straight to the network.
  if (isNextInternal(request, url)) return

  // Document requests are network-only: they fall back to the offline screen,
  // never to a cached document for a different URL.
  if (request.mode === "navigate") {
    event.respondWith(navigationWithOfflineFallback(request))
    return
  }

  // Route to appropriate strategy
  if (FONT_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE))
  } else if (request.destination === "image" || /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/.test(url.pathname)) {
    event.respondWith(cacheFirstWithFallback(request, IMAGE_CACHE))
  } else if (url.pathname.startsWith("/api/")) {
    if (NEVER_CACHE.some((p) => p.test(url.pathname))) {
      event.respondWith(networkOnly(request))
    } else if (SWR_ROUTES.some((p) => url.pathname.startsWith(p))) {
      event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
    } else {
      event.respondWith(networkFirst(request, DYNAMIC_CACHE))
    }
  } else {
    // Everything else (manifest, icons, public files): always try the network
    // first so nothing can be pinned stale, and fall back to the cache offline.
    event.respondWith(networkFirst(request, STATIC_CACHE))
  }
})

// ─── Caching Strategies ────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    if (cached) return cached

    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return new Response("Offline", { status: 503 })
  }
}

async function cacheFirstWithFallback(request, cacheName) {
  try {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    if (cached) return cached

    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Return a placeholder SVG for images
    return new Response(
      '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#1a1a2e"/><text x="200" y="150" text-anchor="middle" fill="#666" font-size="14">📷 Image unavailable offline</text></svg>',
      { headers: { "Content-Type": "image/svg+xml" } }
    )
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request)
    if (cached) return cached

    return new Response(
      JSON.stringify({ error: "Offline", offline: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  // Return cached immediately, update in background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)

  return cached || fetchPromise
}

async function networkOnly(request) {
  try {
    return await fetch(request)
  } catch {
    return new Response(
      JSON.stringify({ error: "Offline", offline: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }
}

async function navigationWithOfflineFallback(request) {
  try {
    // Deliberately not cached: a stored document goes stale the moment it is
    // written, and serving it at a different URL is worse than being offline.
    return await fetch(request)
  } catch {
    // Try offline page
    const offlineCache = await caches.open(STATIC_CACHE)
    const offlinePage = await offlineCache.match("/offline")
    if (offlinePage) return offlinePage

    return new Response(
      `<!DOCTYPE html><html><head><title>Offline</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#030712;color:#f8fafc;text-align:center;padding:2rem">
        <div><h1 style="font-size:1.5rem;margin-bottom:0.5rem">You're offline</h1><p style="color:#94a3b8">Check your connection and try again.</p></div>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  }
}

// ─── Push Notifications ────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {
    title: "loopapp.me",
    body: "You have a new notification!",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: "loop-notification",
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url: "/" },
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      data = { ...data, ...payload }
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      requireInteraction: data.requireInteraction,
      vibrate: data.vibrate,
      data: data.data,
      actions: [
        { action: "open", title: "Open" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  if (event.action === "dismiss") return

  const url = event.notification.data?.url || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus()
          if ("navigate" in client) client.navigate(url)
          return
        }
      }
      // Open new window
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

// ─── Background Sync ───────────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(syncPendingActions())
  }
})

async function syncPendingActions() {
  try {
    // Sync pending operations from IndexedDB
    const db = await openDB()
    if (!db) return

    const tx = db.transaction("pending", "readwrite")
    const store = tx.objectStore("pending")
    const request = store.getAll()

    request.onsuccess = async () => {
      const operations = request.result || []
      for (const op of operations) {
        try {
          await fetch(op.url, {
            method: op.method,
            headers: op.headers,
            body: op.body,
          })
          store.delete(op.id)
        } catch (err) {
          console.warn("[SW] Failed to sync:", op.id)
        }
      }
    }
  } catch (err) {
    console.error("[SW] Background sync failed:", err)
  }
}

function openDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open("loop-offline", 1)
    request.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains("pending")) {
        db.createObjectStore("pending", { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}
