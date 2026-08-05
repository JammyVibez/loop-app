import type { SupabaseClient } from "@supabase/supabase-js"
import {
  extractMentions,
  mentionHref,
  snippetFromText,
  sourceLabel,
  type MentionContext,
  type MentionSource,
} from "@/lib/mentions-shared"

export {
  MENTION_RE,
  extractMentions,
  snippetFromText,
  mentionHref,
  sourceLabel,
  type MentionSource,
  type MentionContext,
} from "@/lib/mentions-shared"

export type MentionedUser = {
  id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
  notification_settings?: any
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
  if (settings.notifications?.mentions === false) return false
  return true
}

/**
 * Persist mention rows + notify tagged users (skips actor, respects settings).
 * Server-only — do not import this module from client components.
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
        circle_id: context.circle_id || null,
        snippet,
        href,
      })),
    )
  } catch (err) {
    console.warn("user_mentions insert skipped:", err)
  }

  const settingsById = new Map((resolved || []).map((p) => [p.id, p.notification_settings]))
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

    // Dynamic import keeps web-push out of any accidental client graph
    try {
      const { sendWebPushToUsers } = await import("@/lib/web-push")
      await sendWebPushToUsers(
        notifyTargets.map((u) => u.id),
        {
          title: `${actorName} tagged you`,
          body: `Tagged you in ${where}${snippet ? `: “${snippet}”` : ""}`,
          url: href || "/notifications",
          tag: `mention-${context.actor_id || "loop"}`,
        },
        { category: "directMessages" },
      )
    } catch (pushErr) {
      console.warn("mention push failed:", pushErr)
    }
  }

  return { mentions: resolved, notified: notifyTargets.length }
}

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
