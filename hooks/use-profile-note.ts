"use client"

/**
 * Client access to `/api/profile-note`.
 *
 * A feed renders one card per post, so a note lookup per card would multiply
 * into a request per row. Notes are cached in memory for a minute and
 * in-flight lookups are de-duplicated, following the same pattern as
 * `useVerificationBadges`: the first card for a user pays, everyone else
 * reuses the answer, and writing a note invalidates it immediately for its
 * owner.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  type NoteSurface,
  type NoteVisibility,
  type ProfileNote,
  isNoteLive,
} from "@/lib/profile-note"

const CACHE_TTL_MS = 60_000

interface CacheEntry {
  note: ProfileNote | null
  at: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<ProfileNote | null>>()

function cacheKey(surface: NoteSurface, userId?: string, username?: string) {
  return `${surface}:${userId || `@${String(username || "").toLowerCase()}`}`
}

async function requestNote(
  surface: NoteSurface,
  userId?: string,
  username?: string,
): Promise<ProfileNote | null> {
  const params = new URLSearchParams({ surface })
  if (userId) params.set("user_id", userId)
  else if (username) params.set("username", username)
  else return null

  try {
    const response = await fetch(`/api/profile-note?${params.toString()}`, { cache: "no-store" })
    if (!response.ok) return null
    const data = await response.json()
    const note = (data?.note || null) as ProfileNote | null
    return note && isNoteLive(note) ? note : null
  } catch {
    // A note is decoration: never let it break the card it sits under.
    return null
  }
}

function loadNote(surface: NoteSurface, userId?: string, username?: string): Promise<ProfileNote | null> {
  const key = cacheKey(surface, userId, username)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.note)

  const pending = inflight.get(key)
  if (pending) return pending

  const request = requestNote(surface, userId, username)
    .then((note) => {
      cache.set(key, { note, at: Date.now() })
      return note
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, request)
  return request
}

export function invalidateProfileNote(userId?: string, username?: string) {
  if (userId) {
    for (const key of cache.keys()) {
      if (key.endsWith(`:${userId}`)) cache.delete(key)
    }
  }
  if (username) {
    const handle = `@${username.toLowerCase()}`
    for (const key of cache.keys()) {
      if (key.endsWith(`:${handle}`)) cache.delete(key)
    }
  }
}

export interface UseProfileNoteResult {
  note: ProfileNote | null
  loading: boolean
  refresh: () => void
}

export function useProfileNote(options: {
  userId?: string
  username?: string
  surface: NoteSurface
  enabled?: boolean
}): UseProfileNoteResult {
  const { userId, username, surface, enabled = true } = options
  const [note, setNote] = useState<ProfileNote | null>(
    () => cache.get(cacheKey(surface, userId, username))?.note ?? null,
  )
  const [loading, setLoading] = useState<boolean>(Boolean(enabled && (userId || username)))
  const [version, setVersion] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || (!userId && !username)) {
      setNote(null)
      setLoading(false)
      return
    }
    setLoading(true)
    loadNote(surface, userId, username)
      .then((result) => {
        if (alive.current) setNote(result)
      })
      .finally(() => {
        if (alive.current) setLoading(false)
      })
  }, [enabled, surface, userId, username, version])

  const refresh = useCallback(() => {
    invalidateProfileNote(userId, username)
    setVersion((v) => v + 1)
  }, [userId, username])

  return { note, loading, refresh }
}

export interface SaveNoteResult {
  ok: boolean
  note?: ProfileNote | null
  error?: string
}

export async function saveProfileNote(
  content: string,
  visibility: Partial<NoteVisibility>,
): Promise<SaveNoteResult> {
  try {
    const response = await fetch("/api/profile-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, visibility }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, error: data?.error || "We couldn't save your note just now." }
    }
    const note = (data?.note || null) as ProfileNote | null
    invalidateProfileNote(note?.user_id)
    return { ok: true, note }
  } catch {
    return { ok: false, error: "We couldn't save your note just now." }
  }
}

export async function deleteProfileNote(userId?: string): Promise<SaveNoteResult> {
  try {
    const response = await fetch("/api/profile-note", { method: "DELETE" })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { ok: false, error: data?.error || "We couldn't delete your note just now." }
    }
    invalidateProfileNote(userId)
    return { ok: true, note: null }
  } catch {
    return { ok: false, error: "We couldn't delete your note just now." }
  }
}
