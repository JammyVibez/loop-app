/** Shared types + constants for the Co-Loop Studio live collaboration surface. */

export type StudioRole = "Primary Creator" | "Co-Author"

/** Fields the live co-edit engine keeps in sync character-by-character. */
export type StudioField = "title" | "content"

export type StudioConnectionState = "connecting" | "live" | "reconnecting" | "offline"

export type StudioMediaType = "text" | "image" | "video"

export interface StudioParticipant {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  video_avatar_url?: string | null
  is_premium?: boolean
  role: StudioRole | string
  /** Live editing indicator: which field this participant is typing in. */
  editing?: StudioField | null
  /** Presence timestamp, used to pick a deterministic sync responder. */
  joinedAt?: number
  color?: string
}

export interface StudioChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_avatar?: string | null
  sender_video_avatar_url?: string | null
  sender_is_premium?: boolean
  text: string
  timestamp: string
  createdAt?: number
}

export interface StudioDocState {
  title: string
  content: string
  hashtags: string[]
  mediaUrl: string
  mediaUrls: string[]
  mediaType: StudioMediaType
}

export interface StudioVersionSnapshot {
  id: string
  versionNumber: number
  title: string
  content: string
  hashtags: string[]
  mediaUrl: string
  mediaUrls: string[]
  mediaType: StudioMediaType
  coAuthors: StudioParticipant[]
  timestamp: string
  createdAt?: number
  label?: string
  savedBy: { id: string; name: string; avatar?: string | null }
}

/** Discrete document fields synced last-writer-wins alongside the live text. */
export interface StudioMetaPatch {
  hashtags?: string[]
  mediaUrl?: string
  mediaUrls?: string[]
  mediaType?: StudioMediaType
  coAuthors?: StudioParticipant[]
}

export type StudioRoomEvent =
  | { type: "version-saved"; version: StudioVersionSnapshot }
  | { type: "version-restored"; version: StudioVersionSnapshot; by: string }
  | { type: "gift"; senderName: string; amount: number; splitAmount: number }
  | { type: "session-ended"; by: string }
  | { type: "published"; by: string }
  | { type: "joined"; participant: StudioParticipant }
  | { type: "left"; participant: StudioParticipant }
  | { type: "co-author-joined"; participant: StudioParticipant }
  | { type: "co-author-kicked"; participant?: StudioParticipant; userId: string; by?: string }
  | { type: "room-lock"; locked: boolean; by: string }
  | { type: "room-deleted"; by: string }
  | { type: "activity"; entry: StudioActivityEntry }
  | { type: "error"; message: string }

/**
 * A collaborator's live caret, as advertised over the channel: which field it
 * sits in and the character offset within that field's text.
 */
export interface StudioCursor {
  id: string
  name: string
  color: string
  field: StudioField
  offset: number
  /** Local receive timestamp — stale cursors age out. */
  at: number
}

/** What happened in the room, in order — the per-session activity feed. */
export type StudioActivityAction =
  | "edited"
  | "version_saved"
  | "version_restored"
  | "published"
  | "locked"
  | "unlocked"
  | "gifted"
  | "invite_sent"
  | "kicked"

export interface StudioActivityEntry {
  id: string
  session_id: string
  actor_id?: string | null
  actor_name: string
  action: StudioActivityAction
  summary?: string | null
  created_at: string
}

/** 1 primary creator + up to 4 invited co-authors. */
export const MAX_CO_AUTHORS = 4

/** Distinct hues used for presence avatars across light and dark themes. */
export const PARTICIPANT_COLORS = ["#0ea5e9", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"]

export function colorForParticipant(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return PARTICIPANT_COLORS[Math.abs(hash) % PARTICIPANT_COLORS.length]
}

export function initialsOf(participant: { display_name?: string; username?: string } | null | undefined): string {
  const source = participant?.display_name || participant?.username || "?"
  return source.trim().charAt(0).toUpperCase() || "?"
}
