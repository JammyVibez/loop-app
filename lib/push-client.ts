"use client"

/** Convert a URL-safe base64 VAPID key to Uint8Array for PushManager.subscribe */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function getClientVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  if (key) return key
  // Must match server fallback in lib/web-push.ts
  return "BCgXnCCUy_9jTxtskWgxBZ7xnGPHgl0CNnbiT_r3XrEguBSYzQK06QD-fhJqlqWtjRbnB7y_S-nJWJcZqrAsli4"
}

export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration()
    if (existing) return existing
    return await navigator.serviceWorker.register("/sw.js")
  } catch (err) {
    console.warn("SW register failed:", err)
    return null
  }
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null
  if (!("Notification" in window) || !("PushManager" in window)) {
    throw new Error("Web Push is not supported in this browser")
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted")
  }

  const registration = await ensureServiceWorker()
  if (!registration) throw new Error("Service worker unavailable")

  await navigator.serviceWorker.ready

  const vapidKey = getClientVapidPublicKey()
  if (!vapidKey) throw new Error("VAPID public key is not configured")

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    })
  }

  return subscription
}

export async function unsubscribeFromPush(): Promise<string | null> {
  const registration = await ensureServiceWorker()
  if (!registration) return null
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return null
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  return endpoint
}

export function subscriptionToJSON(subscription: PushSubscription) {
  const json = subscription.toJSON()
  return {
    endpoint: json.endpoint || subscription.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  }
}
