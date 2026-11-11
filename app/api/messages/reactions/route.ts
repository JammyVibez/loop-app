import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { broadcastRealtime } from "@/lib/realtime-server"

export const dynamic = "force-dynamic"

const getUser = getUserFromRequest

interface GroupedReaction {
  emoji: string
  count: number
  users: string[]
}

/**
 * Persist one toggle to `message_reactions`, tolerating both schema eras.
 *
 * Production ran for months with a NOT NULL `reaction_type` column (and no
 * `emoji` column at all), so a plain `{message_id,user_id,emoji}` upsert failed
 * and every reaction surfaced as “Couldn’t react”. The SQL repair drops that
 * NOT NULL and adds the unique (message_id,user_id,emoji) constraint, but the
 * route must keep working for a database that has not been migrated yet, so it
 * retries with the legacy column before giving up.
 */
async function writeReactionRow(
  supabase: ReturnType<typeof createServerClient>,
  action: "add" | "remove",
  messageId: string,
  userId: string,
  emoji: string,
) {
  // Try the modern `emoji` column first. Deliberately no `upsert`: the unique
  // constraint on (message_id,user_id,emoji) only exists after the SQL repair,
  // and an ON CONFLICT against a missing constraint fails the whole write.
  const existing = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle()

  // Legacy schema: the emoji lives in NOT NULL `reaction_type` and `emoji` does
  // not exist (or is unusable), so every query above errors.
  if (existing.error) {
    if (action === "remove") {
      const removal = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", userId)
        .eq("reaction_type", emoji)
      if (!removal.error) return removal
      return { error: existing.error }
    }
    const legacyInsert = await supabase.from("message_reactions").insert({
      message_id: messageId,
      user_id: userId,
      reaction_type: emoji,
    })
    return legacyInsert.error
      ? { error: legacyInsert.error }
      : { error: null }
  }

  if (action === "remove") {
    if (!existing.data) return { error: null }
    const removal = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
    return removal.error ? { error: removal.error } : { error: null }
  }

  if (existing.data) {
    const touch = await supabase
      .from("message_reactions")
      .update({ created_at: new Date().toISOString() })
      .eq("id", (existing.data as any).id)
    return touch.error ? { error: touch.error } : { error: null }
  }

  const insert = await supabase.from("message_reactions").insert({
    message_id: messageId,
    user_id: userId,
    emoji,
    created_at: new Date().toISOString(),
  })
  return insert.error ? { error: insert.error } : { error: null }
}

/** Read reactions from either schema era, normalised to {emoji, user_id}. */
async function readReactionRows(
  supabase: ReturnType<typeof createServerClient>,
  messageId: string,
): Promise<Array<{ emoji: string; user_id: string }>> {
  const modern = await supabase
    .from("message_reactions")
    .select("emoji, user_id")
    .eq("message_id", messageId)
  if (!modern.error) {
    return ((modern.data || []) as Array<{ emoji: string | null; user_id: string | null }>)
      .filter((row) => row.emoji && row.user_id)
      .map((row) => ({ emoji: String(row.emoji), user_id: String(row.user_id) }))
  }

  const legacy = await supabase
    .from("message_reactions")
    .select("reaction_type, user_id")
    .eq("message_id", messageId)
  if (legacy.error) return []
  return ((legacy.data || []) as Array<{ reaction_type: string | null; user_id: string | null }>)
    .filter((row) => row.reaction_type && row.user_id)
    .map((row) => ({ emoji: String(row.reaction_type), user_id: String(row.user_id) }))
}

/**
 * Load the message and its optional JSONB mirror. `messages.reactions` did not
 * exist on the production schema, and selecting a missing column fails the
 * whole query — which surfaced as a 500 (“Couldn’t react”) before the reaction
 * was ever written.
 */
async function loadMessage(
  supabase: ReturnType<typeof createServerClient>,
  messageId: string,
) {
  const withReactions = await supabase
    .from("messages")
    .select("id, conversation_id, reactions")
    .eq("id", messageId)
    .maybeSingle()
  if (!withReactions.error) return withReactions

  const core = await supabase
    .from("messages")
    .select("id, conversation_id")
    .eq("id", messageId)
    .maybeSingle()
  if (core.error || !core.data) return core
  return { ...core, data: { ...(core.data as any), reactions: [] } }
}

function groupRows(rows: Array<{ emoji: string | null; user_id: string | null }>): GroupedReaction[] {
  const perEmoji = new Map<string, string[]>()
  for (const row of rows) {
    if (!row?.emoji || !row.user_id) continue
    const users = perEmoji.get(row.emoji) || []
    if (!users.includes(row.user_id)) users.push(row.user_id)
    perEmoji.set(row.emoji, users)
  }
  return Array.from(perEmoji.entries()).map(([emoji, users]) => ({
    emoji,
    count: users.length,
    users,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const messageId = request.nextUrl.searchParams.get("message_id")
    if (!messageId) return NextResponse.json({ error: "message_id required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: message, error: messageError } = await loadMessage(supabase, messageId)

    if (messageError) return NextResponse.json({ error: "Could not load message" }, { status: 500 })
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    const { data: membership, error: membershipError } = await supabase
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", message.conversation_id)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle()

    if (membershipError) return NextResponse.json({ error: "Could not verify conversation access" }, { status: 500 })
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Prefer the dedicated table (either schema era); fall back to the JSON on
    // the message row when nothing has been stored there yet.
    const rows = await readReactionRows(supabase, messageId)

    {
      const grouped = (rows.length
        ? groupRows(rows)
        : Array.isArray(message.reactions)
          ? message.reactions as GroupedReaction[]
          : []
      ).map((reaction) => ({
        ...reaction,
        reacted: reaction.users?.includes(user.id) || false,
      }))
      return NextResponse.json({ success: true, reactions: grouped })
    }
  } catch (error) {
    console.error("Message reactions GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    // `messages.id` is a bigint, so the browser sends a JSON number for some
    // conversations. Accepting only strings rejected every such reaction with
    // “Message ID and emoji are required” before it reached the database.
    const messageId = body.message_id == null ? "" : String(body.message_id).trim()
    const emoji = String(body.emoji || "").trim().slice(0, 8)
    const action = body.action === "remove" ? "remove" : "add"

    if (!messageId || !emoji) {
      return NextResponse.json({ error: "Message ID and emoji are required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: message, error: messageError } = await loadMessage(supabase, messageId)

    if (messageError) return NextResponse.json({ error: "Could not load message" }, { status: 500 })
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

    const { data: membership, error: membershipError } = await supabase
      .from("conversation_participants")
      .select("id")
      .eq("conversation_id", message.conversation_id)
      .eq("user_id", user.id)
      .is("left_at", null)
      .maybeSingle()

    if (membershipError) return NextResponse.json({ error: "Could not verify conversation access" }, { status: 500 })
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let reactions: GroupedReaction[]

    // Try the normalized table first. If its schema is unavailable, use the
    // JSONB column as a real persistence fallback rather than returning a
    // success after a failed write.
    const write = await writeReactionRow(supabase, action, messageId, user.id, emoji)

    if (write.error) {
      console.warn("message_reactions write; using JSONB fallback:", (write.error as any)?.message)
      const current: GroupedReaction[] = Array.isArray(message.reactions) ? [...message.reactions] : []
      const idx = current.findIndex((reaction: any) => reaction.emoji === emoji)
      if (action === "add") {
        if (idx >= 0) {
          const users = Array.from(new Set<string>([...(current[idx].users || []), user.id]))
          current[idx] = { emoji, count: users.length, users }
        } else {
          current.push({ emoji, count: 1, users: [user.id] })
        }
      } else if (idx >= 0) {
        const users = (current[idx].users || []).filter((id: string) => id !== user.id)
        if (users.length) current[idx] = { emoji, count: users.length, users }
        else current.splice(idx, 1)
      }

      const fallback = await supabase
        .from("messages")
        .update({ reactions: current })
        .eq("id", messageId)
        .select("id")
        .maybeSingle()
      if (fallback.error || !fallback.data) {
        console.error("Message reaction fallback failed:", fallback.error?.message || "message not found")
        return NextResponse.json({ error: "Could not save that reaction" }, { status: 500 })
      }
      reactions = current
    } else {
      // Re-read the table so the response is the real persisted state.
      const rows = await readReactionRows(supabase, messageId)
      reactions = groupRows(rows)

      // Mirror the grouped counts so older message readers remain compatible.
      const mirror = await supabase.from("messages").update({ reactions }).eq("id", messageId)
      if (mirror.error) console.warn("message reaction mirror:", mirror.error.message)
    }

    await broadcastRealtime(`conversation:${message.conversation_id}`, "reaction", {
      message_id: messageId,
      emoji,
      action,
      user_id: user.id,
      reactions,
    })

    return NextResponse.json({
      success: true,
      message: action === "add" ? "Reaction added" : "Reaction removed",
      reactions,
    })
  } catch (error) {
    console.error("Message reaction error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
