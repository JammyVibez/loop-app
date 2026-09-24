/**
 * "Continue where you left off" — a single per-user resume point for Messages.
 *
 * Closing the tab used to leave no trace: the next visit was a blank list and
 * you had to remember who you were mid-conversation with. We keep the last
 * conversation you opened (plus when you left) in localStorage, which is
 * per-device convenience rather than account data, and surface it in the inbox.
 */

export interface ChatResumePoint {
  id: string
  name: string
  avatarUrl?: string | null
  videoAvatarUrl?: string | null
  isGroup?: boolean
  preview?: string
  /** ISO timestamp of the moment the reader left this conversation. */
  at: string
}

const RESUME_STORAGE_PREFIX = "loop:messages:resume:"

export function chatResumeStorageKey(userId?: string) {
  return `${RESUME_STORAGE_PREFIX}${userId || "guest"}`
}

export function readChatResumePoint(userId?: string): ChatResumePoint | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(chatResumeStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ChatResumePoint
    return parsed?.id ? parsed : null
  } catch {
    // Storage disabled or a corrupt value — the card is simply absent.
    return null
  }
}

export function writeChatResumePoint(userId: string | undefined, point: ChatResumePoint | null) {
  if (typeof window === "undefined") return
  try {
    const key = chatResumeStorageKey(userId)
    if (point) window.localStorage.setItem(key, JSON.stringify(point))
    else window.localStorage.removeItem(key)
  } catch {
    /* storage disabled — nothing to persist */
  }
}
