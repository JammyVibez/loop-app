"use client"

/**
 * Drop an author's live note into any card. Fetch is cached across the feed,
 * so twenty cards by the same author cost one request, and a missing/expired
 * note renders nothing at all.
 */

import { type NoteSurface } from "@/lib/profile-note"
import { useProfileNote } from "@/hooks/use-profile-note"
import { NoteLink } from "./note-bubble"

export function NoteChip({
  userId,
  username,
  surface,
  className,
}: {
  userId?: string | null
  username?: string | null
  surface: NoteSurface
  className?: string
}) {
  const { note } = useProfileNote({
    userId: userId ? String(userId) : undefined,
    username: username ? String(username) : undefined,
    surface,
    enabled: Boolean(userId || username),
  })

  if (!note) return null
  return <NoteLink note={note} username={username} variant="card" className={className} />
}
