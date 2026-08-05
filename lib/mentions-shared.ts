/**
 * Client-safe mention helpers (no Node/web-push imports).
 * Keep this free of server-only modules so client pages can import it.
 */

/** Matches @username (3–30 chars, same rules as signup normalize) */
export const MENTION_RE = /@([a-zA-Z0-9_]{3,30})\b/g

export type MentionSource =
  | "loop"
  | "loop_comment"
  | "circle_post"
  | "circle_comment"
  | "circle_room"
  | "reel_comment"
  | "message"

export type MentionContext = {
  source: MentionSource
  loop_id?: string | null
  comment_id?: string | null
  circle_id?: string | null
  post_id?: string | null
  reel_id?: string | null
  conversation_id?: string | null
  room_id?: string | null
  actor_id: string
  actor_username?: string | null
  actor_display_name?: string | null
  snippet?: string | null
  href?: string | null
}

export function extractMentions(text: string): string[] {
  if (!text) return []
  const found = new Set<string>()
  const re = new RegExp(MENTION_RE.source, "g")
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const username = match[1].toLowerCase()
    if (username) found.add(username)
  }
  return Array.from(found)
}

export function snippetFromText(text: string, max = 120) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max - 1)}…`
}

export function mentionHref(
  ctx: Pick<
    MentionContext,
    | "source"
    | "loop_id"
    | "circle_id"
    | "post_id"
    | "reel_id"
    | "comment_id"
    | "conversation_id"
    | "room_id"
    | "href"
  >,
) {
  if (ctx.href) return ctx.href
  if (ctx.source === "loop" || ctx.source === "loop_comment") {
    return ctx.loop_id ? `/loop/${ctx.loop_id}` : "/notifications?type=mention"
  }
  if (ctx.source === "circle_post" || ctx.source === "circle_comment") {
    if (ctx.circle_id) return `/circles/${ctx.circle_id}`
    return "/notifications?type=mention"
  }
  if (ctx.source === "circle_room" && ctx.circle_id) {
    return ctx.room_id
      ? `/circles/${ctx.circle_id}?room=${ctx.room_id}`
      : `/circles/${ctx.circle_id}`
  }
  if (ctx.source === "reel_comment") {
    return ctx.reel_id ? `/reels?focus=${ctx.reel_id}` : "/reels"
  }
  if (ctx.source === "message" && ctx.conversation_id) {
    return `/messages?c=${ctx.conversation_id}`
  }
  return "/notifications?type=mention"
}

export function sourceLabel(source: string) {
  switch (source) {
    case "loop":
      return "a loop"
    case "loop_comment":
      return "a comment"
    case "circle_post":
      return "a community post"
    case "circle_comment":
      return "a community comment"
    case "circle_room":
      return "a community chat"
    case "reel_comment":
      return "a reel comment"
    case "message":
      return "a message"
    default:
      return "a post"
  }
}
