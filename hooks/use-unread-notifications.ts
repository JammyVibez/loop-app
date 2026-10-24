"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"

/**
 * Unread notification count for the tab bar badge.
 *
 * The dropdown owns the full list; this hook only needs the number, so it asks
 * for a small page and counts what has not been read (community mentions,
 * replies, follows and the rest all land in the same inbox). Polling stops
 * while the tab is hidden so a backgrounded app costs nothing.
 */
export function useUnreadNotifications() {
  const { user, getAuthHeader } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!user) {
      setCount(0)
      return
    }
    let active = true

    const load = async () => {
      try {
        const res = await fetch("/api/notifications?limit=25", { headers: getAuthHeader() })
        if (!res.ok) return
        const json = await res.json().catch(() => ({}))
        const list = Array.isArray(json.notifications) ? json.notifications : []
        const unread = list.filter((n: any) => !n.is_read && !n.read_at).length
        if (active) setCount(unread)
      } catch {
        /* offline — keep the last number */
      }
    }

    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 60_000)
    // The dropdown broadcasts the moment it marks something read, so the badge
    // clears immediately instead of after the next poll.
    const onChanged = () => void load()
    window.addEventListener("loop:notifications-changed", onChanged)

    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener("loop:notifications-changed", onChanged)
    }
  }, [user, getAuthHeader])

  return count
}
