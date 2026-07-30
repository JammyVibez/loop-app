import type { SupabaseClient } from "@supabase/supabase-js"

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

export type MentionedUser = {
  id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
}

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
  if (ctx.source === "reel_comment" && ctx.reel_id) return `/reels?focus=${ctx.reel_id}`
  if (ctx.source === "message" && ctx.conversation_id) {
    return `/messages?c=${ctx.conversation_id}`
  }
  return "/notifications?type=mention"
}

export function sourceLabel(source: MentionSource) {
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

export async function resolveMentionedUsers(
  supabase: SupabaseClient,
  usernames: string[],
): Promise<MentionedUser[]> {
  const unique = [...new Set(usernames.map((u) => u.toLowerCase()).filter(Boolean))]
  if (!unique.length) return []

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, notification_settings")
    .in("username", unique)

  if (error || !data) {
    console.error("resolveMentionedUsers:", error?.message)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    notification_settings: (row as any).notification_settings,
  })) as MentionedUser[]
}

function wantsMentionNotifications(settings: any) {
  if (!settings || typeof settings !== "object") return true
  if (settings.mentions === false) return false
  if (settings.mentions === true) return true
  // Nested / alternate shapes
  if (settings.notifications?.mentions === false) return false
  return true
}

/**
 * Persist mention rows + notify tagged users (skips actor, respects settings).
 */
export async function processMentions(
  supabase: SupabaseClient,
  text: string,
  context: MentionContext,
) {
  const usernames = extractMentions(text)
  if (!usernames.length) return { mentions: [] as MentionedUser[], notified: 0 }

  const resolved = await resolveMentionedUsers(supabase, usernames)
  const targets = resolved.filter((u) => u.id !== context.actor_id)
  if (!targets.length) return { mentions: resolved, notified: 0 }

  const snippet = context.snippet || snippetFromText(text)
  const href = mentionHref(context)
  const actorName = context.actor_display_name || context.actor_username || "Someone"
  const where = sourceLabel(context.source)

  // Optional ledger for "Tagged" inbox
  try {
    await supabase.from("user_mentions").insert(
      targets.map((user) => ({
        mentioned_user_id: user.id,
        actor_id: context.actor_id,
        source_type: context.source,
        source_id:
          context.comment_id ||
          context.post_id ||
          context.loop_id ||
          context.reel_id ||
          null,
        loop_id: context.loop_id || null,
        comment_id: context.comment_id || null,
        circle_id: context.circle_id || null,
        post_id: context.post_id || null,
        reel_id: context.reel_id || null,
        snippet,
        href,
      })),
    )
  } catch (err) {
    console.error("user_mentions insert skipped:", err)
  }

  // Prefer profiles with mention settings for filtering
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, notification_settings")
    .in(
      "id",
      targets.map((t) => t.id),
    )

  const settingsById = new Map((profiles || []).map((p) => [p.id, p.notification_settings]))
  const notifyTargets = targets.filter((t) => wantsMentionNotifications(settingsById.get(t.id)))

  if (notifyTargets.length) {
    const rows = notifyTargets.map((user) => ({
      user_id: user.id,
      type: "mention",
      title: `${actorName} tagged you`,
      message: `Tagged you in ${where}${snippet ? `: “${snippet}”` : ""}`,
      data: {
        ...context,
        snippet,
        href,
        mentioned_username: user.username,
      },
      actor_id: context.actor_id,
      is_read: false,
    }))

    const { error } = await supabase.from("notifications").insert(rows)
    if (error) console.error("mention notifications:", error.message)
  }

  return { mentions: resolved, notified: notifyTargets.length }
}

/** Store usernames array for a content row (best-effort) */
export async function attachMentionsColumn(
  supabase: SupabaseClient,
  table: string,
  id: string,
  usernames: string[],
) {
  if (!usernames.length) return
  try {
    const { error } = await supabase.from(table).update({ mentions: usernames }).eq("id", id)
    if (error) console.error(`attachMentionsColumn ${table}:`, error.message)
  } catch {
    /* column may not exist */
  }
}
