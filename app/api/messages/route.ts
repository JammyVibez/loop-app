import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { checkBlockStatus } from "@/lib/user-blocks"
import { broadcastRealtime } from "@/lib/realtime-server"

export const dynamic = "force-dynamic"

const getUser = getUserFromRequest

export interface GroupedReaction {
  emoji: string
  count: number
  users: string[]
}

/**
 * Reactions live in `message_reactions` (one row per user + emoji). The thread
 * used to read only `messages.reactions`, which the write path no longer
 * touches, so a saved reaction vanished on the next load. Attach the grouped
 * form here so every reader — the sender, the peer, a reload — sees the same
 * state.
 */
async function attachReactions(
  supabase: ReturnType<typeof createServerClient>,
  rows: any[],
): Promise<any[]> {
  if (!rows.length) return rows
  // `messages.id` is numeric while `message_reactions.message_id` is text —
  // stringifying keeps PostgREST comparing against the right column type.
  const ids = rows.map((row) => (row?.id == null ? null : String(row.id))).filter(Boolean) as string[]
  if (!ids.length) return rows

  const { data, error } = await supabase
    .from("message_reactions")
    .select("message_id, emoji, user_id")
    .in("message_id", ids)

  if (error || !data) return rows

  const grouped = new Map<string, Map<string, string[]>>()
  for (const row of data as Array<{ message_id: string | number; emoji: string | null; user_id: string | null }>) {
    if (row?.message_id == null || !row.emoji || !row.user_id) continue
    const key = String(row.message_id)
    const perEmoji = grouped.get(key) || new Map<string, string[]>()
    const users = perEmoji.get(row.emoji) || []
    if (!users.includes(row.user_id)) users.push(row.user_id)
    perEmoji.set(row.emoji, users)
    grouped.set(key, perEmoji)
  }

  return rows.map((row) => {
    const perEmoji = grouped.get(String(row.id))
    if (!perEmoji) return { ...row, reactions: [] }
    const reactions: GroupedReaction[] = Array.from(perEmoji.entries()).map(([emoji, users]) => ({
      emoji,
      count: users.length,
      users,
    }))
    return { ...row, reactions }
  })
}

async function assertMember(supabase: ReturnType<typeof createServerClient>, conversationId: string, userId: string) {
  const { data } = await supabase
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle()
  return Boolean(data)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversation_id")
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "80") || 80, 1), 200)
    // `before` (ISO timestamp) pages backwards from the oldest message the
    // client already holds. Without it we return the NEWEST window — ordering
    // ascending and slicing from offset 0 returns the OLDEST messages, which
    // made freshly received messages vanish on the next reconciliation.
    const before = searchParams.get("before")
    const parseIso = (value: string | null) => {
      if (!value) return null
      const ts = Date.parse(value)
      return Number.isFinite(ts) ? new Date(ts).toISOString() : null
    }
    const beforeIso = parseIso(before)

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!(await assertMember(supabase, conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Newest-first ordering, then reverse so callers always receive the page in
    // chronological (oldest → newest) order.
    let query = supabase
      .from("messages")
      .select(`
        id,
        conversation_id,
        content,
        media_url,
        media_type,
        message_type,
        sender_id,
        author_id,
        reply_to_id,
        reactions,
        created_at,
        is_read,
        is_edited,
        edited_at,
        is_deleted,
        forwarded_from,
        forwarded_message_id,
        sender:profiles!messages_author_id_fkey(
          id, username, display_name, avatar_url
        )
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (beforeIso) query = query.lt("created_at", beforeIso)

    const { data: messagesDesc, error } = await query

    const toAscending = <T,>(rows: T[] | null | undefined): T[] => (rows || []).slice().reverse()

    if (error) {
      // Fallback without join alias if FK name differs
      let fallbackQuery = supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit)
      if (beforeIso) fallbackQuery = fallbackQuery.lt("created_at", beforeIso)
      const fallback = await fallbackQuery
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })

      const rows = toAscending(fallback.data as any[])
      const senderIds = Array.from(
        new Set(rows.map((m) => m.author_id || m.sender_id).filter(Boolean)),
      )
      const { data: profiles } = senderIds.length
        ? await supabase.from("profiles").select("id, username, display_name, avatar_url, video_avatar_url").in("id", senderIds)
        : { data: [] as any[] }
      const map = new Map((profiles || []).map((p) => [p.id, p]))
      const hydrated = rows.map((m) => ({
        ...m,
        sender: map.get(m.author_id || m.sender_id) || null,
      }))
      const withReactions = await attachReactions(supabase, hydrated)
      return NextResponse.json({ success: true, messages: withReactions, has_more: rows.length === limit })
    }

    const messages = await attachReactions(supabase, toAscending(messagesDesc as any[]))
    return NextResponse.json({ success: true, messages, has_more: messages.length === limit })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const conversationId = body.conversation_id
    const content = String(body.content || "").trim()
    const messageType = body.message_type || "text"
    const mediaUrl = body.media_url || body.file_url || null
    const replyToId = body.reply_to_id || body.replyToId || null
    const forwardedFrom = body.forwarded_from || body.forwardedFrom || null
    const forwardedMessageId = body.forwarded_message_id || body.forwardedMessageId || null

    if (!conversationId || (!content && !mediaUrl && !forwardedMessageId)) {
      return NextResponse.json({ error: "Conversation ID and content are required" }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!(await assertMember(supabase, conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Enforce the other participant's message_privacy on 1:1 conversations.
    const { data: participants } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .is("left_at", null)
    const others = (participants || []).filter((p) => p.user_id !== user.id)
    if (others.length === 1) {
      const recipientId = others[0].user_id

      // Blocks work in both directions — neither side can DM the other.
      const blockStatus = await checkBlockStatus(supabase, user.id, recipientId)
      if (blockStatus.blocked) {
        return NextResponse.json({ error: "You can't message this user" }, { status: 403 })
      }

      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("privacy_settings")
        .eq("id", recipientId)
        .maybeSingle()
      const recipientPrivacy = (recipientProfile as any)?.privacy_settings || {}
      const messagePrivacy = recipientPrivacy.message_privacy || "everyone"
      if (messagePrivacy === "nobody" || messagePrivacy === "none") {
        return NextResponse.json(
          { error: "This user has disabled direct messages." },
          { status: 403 },
        )
      }
      if (messagePrivacy === "followers") {
        const [{ data: senderFollows }, { data: recipientFollows }] = await Promise.all([
          supabase
            .from("follows")
            .select("id")
            .eq("follower_id", user.id)
            .eq("following_id", recipientId)
            .maybeSingle(),
          supabase
            .from("follows")
            .select("id")
            .eq("follower_id", recipientId)
            .eq("following_id", user.id)
            .maybeSingle(),
        ])
        if (!senderFollows && !recipientFollows) {
          return NextResponse.json(
            { error: "This user only accepts messages from people they follow or who follow them." },
            { status: 403 },
          )
        }
      }
    }

    const basePayload: Record<string, any> = {
      conversation_id: conversationId,
      sender_id: user.id,
      author_id: user.id,
      content: content || (mediaUrl ? "Shared media" : ""),
      message_type: messageType,
      media_url: mediaUrl,
      media_type: messageType === "text" ? null : messageType,
      created_at: new Date().toISOString(),
    }

    // Extract @mentions from content and store as JSONB for targeted
    // notifications in group chats (bypasses muting for mentioned users).
    try {
      const { extractMentions } = await import("@/lib/mentions")
      const mentions = extractMentions(content)
      if (mentions.length) basePayload.mentions = mentions
    } catch { /* mentions extraction is best-effort */ }

    // Forwards carry a human-readable origin label + the original message id.
    if (forwardedFrom) basePayload.forwarded_from = String(forwardedFrom).slice(0, 80)
    if (forwardedMessageId) basePayload.forwarded_message_id = String(forwardedMessageId)

    let message: any = null
    let messageError: any = null

    const withReply = replyToId ? { ...basePayload, reply_to_id: replyToId } : basePayload
    ;({ data: message, error: messageError } = await supabase.from("messages").insert(withReply).select("*").single())

    // Older DBs without the forward columns: retry without them (the core
    // message still sends, the forward label is just dropped).
    if (messageError && /forwarded_from|forwarded_message_id|PGRST204|column/i.test(messageError.message || "")) {
      const slim: Record<string, any> = { ...basePayload }
      delete slim.forwarded_from
      delete slim.forwarded_message_id
      const slimWithReply = replyToId ? { ...slim, reply_to_id: replyToId } : slim
      ;({ data: message, error: messageError } = await supabase.from("messages").insert(slimWithReply).select("*").single())
    }

    if (messageError && replyToId && /reply_to|PGRST204|column/i.test(messageError.message || "")) {
      ;({ data: message, error: messageError } = await supabase.from("messages").insert(basePayload).select("*").single())
    }

    if (messageError) {
      return NextResponse.json({ error: messageError.message || "Failed to send message" }, { status: 500 })
    }

    let replyPreview: any = null
    if (replyToId) {
      const { data: replied } = await supabase
        .from("messages")
        .select("id, content, sender_id, author_id, media_type")
        .eq("id", replyToId)
        .maybeSingle()
      replyPreview = replied
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url")
      .eq("id", user.id)
      .maybeSingle()

    const enriched = {
      ...message,
      reply_to: replyPreview,
      sender: {
        id: user.id,
        username: senderProfile?.username || user.user_metadata?.username,
        display_name: senderProfile?.display_name || user.user_metadata?.display_name || user.user_metadata?.username,
        avatar_url: senderProfile?.avatar_url || user.user_metadata?.avatar_url,
      },
    }

    // Fan out over Realtime REST: the peer's open thread appends this without
    // waiting for the next poll. Never blocks the send if Realtime is down.
    await broadcastRealtime(`conversation:${conversationId}`, "new_message", enriched)

    // Notify other participants (in-app + real Web Push) so a new DM is
    // never silent, matching the same pattern used for mentions/gifts.
    try {
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .is("left_at", null)

      const preview = String(content || (mediaUrl ? "Sent an attachment" : "New message")).slice(0, 120)
      const { notifyUser } = await import("@/lib/notifications")
      await Promise.all(
        (participants || [])
          .map((p: any) => p.user_id)
          .filter((id: string) => id && id !== user.id)
          .map((recipientId: string) =>
            notifyUser(supabase, {
              userId: recipientId,
              type: "message",
              title: enriched.sender?.display_name || enriched.sender?.username || "New message",
              message: preview,
              actorId: user.id,
              actionUrl: `/messages?c=${conversationId}`,
              data: { conversation_id: conversationId, message_id: message.id },
              pushCategory: "directMessages",
            }),
          ),
      )
    } catch (notifyErr) {
      console.warn("Message push notify failed:", notifyErr)
    }

    if (content) {
      try {
        const { processMentions, extractMentions } = await import("@/lib/mentions")
        const mentionObjects = extractMentions(content)
        if (mentionObjects.length) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("id", user.id)
            .maybeSingle()
          await processMentions(supabase, content, {
            source: "message",
            conversation_id: conversationId,
            actor_id: user.id,
            actor_username: profile?.username || user.user_metadata?.username,
            actor_display_name:
              profile?.display_name || user.user_metadata?.display_name || user.user_metadata?.username,
            href: `/messages?c=${conversationId}`,
          })
          // Targeted @mention notification that bypasses group muting
          try {
            const mentionedUsernames = mentionObjects.map((m: any) => m.username || m).filter(Boolean)
            if (mentionedUsernames.length) {
              const { data: mentionedProfiles } = await supabase
                .from("profiles")
                .select("id")
                .in("username", mentionedUsernames)
              const mentionedIds = (mentionedProfiles || []).map((p) => p.id).filter((id) => id !== user.id)
              if (mentionedIds.length) {
                const { notifyUser } = await import("@/lib/notifications")
                const mentionerName = profile?.display_name || profile?.username || "Someone"
                await Promise.all(
                  mentionedIds.map((rid: string) =>
                    notifyUser(supabase, {
                      userId: rid,
                      type: "mention",
                      title: `${mentionerName} mentioned you`,
                      message: String(content).slice(0, 120),
                      actorId: user.id,
                      actionUrl: `/messages?c=${conversationId}`,
                      data: { conversation_id: conversationId, message_id: message.id },
                      pushCategory: "social",
                    }),
                  ),
                )
              }
            }
          } catch (mErr) { console.warn("@mention notify failed:", mErr) }
        }
      } catch (err) {
        console.error("message mentions:", err)
      }
    }

    return NextResponse.json({ success: true, message: enriched })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
