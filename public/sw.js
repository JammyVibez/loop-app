const CACHE_NAME = "loop-social-v2.1"
const STATIC_CACHE = "loop-static-v2.1"
const DYNAMIC_CACHE = "loop-dynamic-v2.1"
const IMAGE_CACHE = "loop-images-v2.1"

// Static assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/offline",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/styles/3d-framework.css",
  "/styles/responsive.css",
]

// API routes that should be cached
const API_CACHE_PATTERNS = [/^\/api\/shop\/items/, /^\/api\/quests/, /^\/api\/inventory/]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...")
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log("Service Worker: Caching static assets")
        return cache.addAll(STATIC_ASSETS)
      }),
      self.skipWaiting(),
    ]),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating...")
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== IMAGE_CACHE &&
              cacheName !== CACHE_NAME
            ) {
              console.log("Service Worker: Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      }),
      self.clients.claim(),
    ]),
  )
})

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== "GET" || url.protocol === "chrome-extension:") {
    return
  }

  // Handle different types of requests with appropriate strategies
  if (request.destination === "image") {
    event.respondWith(handleImageRequest(request))
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(handleAPIRequest(request))
  } else if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request))
  } else {
    event.respondWith(handleStaticRequest(request))
  }
})

// Image caching strategy - Cache First with fallback
async function handleImageRequest(request) {
  try {
    const cache = await caches.open(IMAGE_CACHE)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log("Image request failed:", error)
    // Return placeholder image
    return new Response(
      '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="200" fill="#f3f4f6"/><text x="100" y="100" text-anchor="middle" fill="#9ca3af">Image unavailable</text></svg>',
      { headers: { "Content-Type": "image/svg+xml" } },
    )
  }
}

// API caching strategy - Network First with cache fallback
async function handleAPIRequest(request) {
  const url = new URL(request.url)
  const shouldCache = API_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname))

  if (!shouldCache) {
    return fetch(request)
  }

  try {
    const cache = await caches.open(DYNAMIC_CACHE)
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log("API request failed, trying cache:", error)
    const cache = await caches.open(DYNAMIC_CACHE)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // Return offline response for API requests
    return new Response(
      JSON.stringify({
        error: "Offline",
        message: "This feature is not available offline",
        offline: true,
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

// Navigation caching strategy - Network First with offline fallback
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request)

    // Cache successful navigation responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.log("Navigation request failed, trying cache:", error)
    const cache = await caches.open(DYNAMIC_CACHE)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // Return offline page
    const offlineCache = await caches.open(STATIC_CACHE)
    return (
      offlineCache.match("/offline") ||
      new Response(
        "<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>",
        { headers: { "Content-Type": "text/html" } },
      )
    )
  }
}

// Static asset caching strategy - Cache First
async function handleStaticRequest(request) {
  try {
    const cache = await caches.open(STATIC_CACHE)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log("Static request failed:", error)
    return new Response("Resource unavailable offline", { status: 503 })
  }
}

// Push notification event
self.addEventListener("push", (event) => {
  console.log("Push notification received")

  let notificationData = {
    title: "Loop Social",
    body: "You have a new notification!",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: "loop-notification",
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: Math.random(),
    },
    actions: [
      {
        action: "open",
        title: "Open Loop",
        icon: "/icons/icon-96x96.png",
      },
      {
        action: "close",
        title: "Close",
        icon: "/icons/icon-96x96.png",
      },
    ],
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      notificationData = { ...notificationData, ...payload }
    } catch (error) {
      console.log("Error parsing push data:", error)
      notificationData.body = event.data.text()
    }
  }

  event.waitUntil(self.registration.showNotification(notificationData.title, notificationData))
})

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event.action)
  event.notification.close()

  if (event.action === "close") {
    return
  }

  const urlToOpen = event.action === "open" ? "/" : event.notification.data?.url || "/"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus()
        }
      }

      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    }),
  )
})

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("Background sync triggered:", event.tag)

  if (event.tag === "background-sync") {
    event.waitUntil(performBackgroundSync())
  } else if (event.tag === "quest-completion") {
    event.waitUntil(syncQuestCompletions())
  } else if (event.tag === "coin-transactions") {
    event.waitUntil(syncCoinTransactions())
  }
})

// Perform background sync operations
async function performBackgroundSync() {
  try {
    console.log("Performing background sync...")

    // Sync pending operations from IndexedDB
    const pendingOperations = await getPendingOperations()

    for (const operation of pendingOperations) {
      try {
        await fetch(operation.url, {
          method: operation.method,
          headers: operation.headers,
          body: operation.body,
        })

        // Remove successful operation from pending list
        await removePendingOperation(operation.id)
      } catch (error) {
        console.log("Failed to sync operation:", operation.id, error)
      }
    }

    console.log("Background sync completed")
  } catch (error) {
    console.error("Background sync failed:", error)
  }
}

// Sync quest completions when back online
async function syncQuestCompletions() {
  try {
    const response = await fetch("/api/quests/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    if (response.ok) {
      console.log("Quest completions synced successfully")
    }
  } catch (error) {
    console.error("Failed to sync quest completions:", error)
  }
}

// Sync coin transactions when back online
async function syncCoinTransactions() {
  try {
    const response = await fetch("/api/coins/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    if (response.ok) {
      console.log("Coin transactions synced successfully")
    }
  } catch (error) {
    console.error("Failed to sync coin transactions:", error)
  }
}

// Helper functions for IndexedDB operations
async function getPendingOperations() {
  // Implementation would use IndexedDB to store/retrieve pending operations
  return []
}

async function removePendingOperation(id) {
  // Implementation would remove operation from IndexedDB
  console.log("Removing pending operation:", id)
}

// Handle periodic background sync (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "content-sync") {
    event.waitUntil(syncContent())
  }
})

async function syncContent() {
  try {
    // Sync latest content in background
    await fetch("/api/sync/content", { method: "POST" })
    console.log("Content sync completed")
  } catch (error) {
    console.error("Content sync failed:", error)
  }
}

// Handle share target
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  if (url.pathname === "/share" && event.request.method === "POST") {
    event.respondWith(handleShareTarget(event.request))
  }
})

async function handleShareTarget(request) {
  try {
    const formData = await request.formData()
    const title = formData.get("title") || ""
    const text = formData.get("text") || ""
    const url = formData.get("url") || ""
    const files = formData.getAll("files")

    // Store shared data for the app to process
    const shareData = { title, text, url, files: files.length }

    // Redirect to share page with data
    const shareUrl = `/share?data=${encodeURIComponent(JSON.stringify(shareData))}`

    return Response.redirect(shareUrl, 302)
  } catch (error) {
    console.error("Error handling share target:", error)
    return Response.redirect("/", 302)
  }
}
