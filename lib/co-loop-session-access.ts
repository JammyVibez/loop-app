export interface CoLoopSessionRoster {
  owner_id?: unknown
  co_authors?: unknown
}

/** True only for the room host or a persisted co-author. */
export function isCoLoopParticipant(session: CoLoopSessionRoster, userId: string): boolean {
  if (!userId) return false
  if (session.owner_id === userId) return true
  if (!Array.isArray(session.co_authors)) return false
  return session.co_authors.some((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false
    return "id" in entry && entry.id === userId
  })
}
