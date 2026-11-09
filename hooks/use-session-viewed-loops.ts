"use client"

import { useCallback, useEffect, useRef } from "react"

const MAX_SESSION_IDS = 160

/**
 * Tracks loops the viewer has actually seen in this browser session. The feed
 * sends these ids to the server so For You does not recycle posts after a
 * refresh or a hard refresh.
 */
export function useSessionViewedLoops(viewerKey: string) {
  const storageKey = `loop:feed-viewed:v1:${viewerKey || "guest"}`
  const viewedRef = useRef<Set<string>>(new Set())
  const loadedKeyRef = useRef<string | null>(null)

  const load = useCallback(() => {
    if (typeof window === "undefined" || loadedKeyRef.current === storageKey) return
    loadedKeyRef.current = storageKey
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      const parsed = raw ? JSON.parse(raw) : []
      viewedRef.current = new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [])
    } catch {
      viewedRef.current = new Set()
    }
  }, [storageKey])

  useEffect(() => {
    load()
  }, [load])

  const markViewed = useCallback(
    (loopId: string) => {
      if (!loopId) return
      load()
      if (viewedRef.current.has(loopId)) return
      viewedRef.current.add(loopId)
      // Keep the oldest ids around briefly as a safety net, but cap the
      // request/storage size for long sessions.
      const ids = [...viewedRef.current].slice(-MAX_SESSION_IDS)
      viewedRef.current = new Set(ids)
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(ids))
      } catch {
        /* Storage can be disabled in private mode; in-memory still works. */
      }
    },
    [load, storageKey],
  )

  const getViewedIds = useCallback(() => {
    load()
    return [...viewedRef.current].slice(-MAX_SESSION_IDS)
  }, [load])

  return { markViewed, getViewedIds }
}
