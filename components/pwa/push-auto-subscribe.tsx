"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@/hooks/use-auth"
import {
  ensureServiceWorker,
  subscribeToPush,
  subscriptionToJSON,
} from "@/lib/push-client"

/**
 * Silently keeps a real Web Push subscription in sync for logged-in users
 * who already granted notification permission (no mock endpoints).
 */
export function PushAutoSubscribe() {
  const { user, getAuthHeader } = useAuth()
  const synced = useRef<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    if (typeof window === "undefined") return
    if (!("Notification" in window) || Notification.permission !== "granted") return
    if (synced.current === user.id) return

    let cancelled = false

    const run = async () => {
      try {
        await ensureServiceWorker()
        const subscription = await subscribeToPush()
        if (!subscription || cancelled) return

        const payload = subscriptionToJSON(subscription)
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify(payload),
        })
        synced.current = user.id
      } catch (err) {
        console.warn("Auto push subscribe skipped:", err)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [user?.id, getAuthHeader])

  return null
}
