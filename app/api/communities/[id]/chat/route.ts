import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { notifyUser } from "@/lib/notifications"

export const dynamic = "force-dynamic"

/**
 * Community Space Chat API
 *
 * Uses circle_room_messages (the actual community chat table)
 * linked via circle_rooms (room_id → circle_rooms.id → circle_id → community)
 *
 * GET  ?limit=80&offset=0&space_id=...  — fetch messages for this community
 * POST { content, space_id?, reply_to_id?, media_url?, media_type? }  — send a message
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: communityId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Verify membership
    const { data: membership } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", communityId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "You must be a member to view chat" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit") || "80"), 200)
    const offset = Number(searchParams.get("offset") || "0")
    const spaceId = searchParams.get("space_id")

    // If space_id is provided, find the room_id for that space
    let roomIds: number[] | null = null
    if (spaceId) {
      const { data: room } = await supabase
        .from("circle_rooms")
        .select("id")
        .eq("circle_id", communityId)
        .eq("id", spaceId)
        .maybeSingle()
      if (room) roomIds = [room.id]
    } else {
      // Get all rooms for this community
      const { data: rooms } = await supabase
        .from("circle_rooms")
        .select("id")
        .eq("circle_id", communityId)
      if (rooms) roomIds = rooms.map((r: any) => r.id)
    }

    if (!roomIds || roomIds.length === 0) {
      return NextResponse.json({ success: true, messages: [] })
    }

    const { data: messages, error } = await supabase
      .from("circle_room_messages")
      .select(`
        id,
        content,
        media_url,
        media_type,
        message_type,
        room_id,
        author_id,
        reply_to_id,
        reactions,
        is_edited,
        is_bot,
        bot_name,
        created_at,
        author:profiles!circle_room_messages_author_id_fkey(
          id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_organization, is_premium, badge_id
        )
      `)
      .in("room_id", roomIds)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Community chat fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Hydrate reply previews so replies show the quoted snippet instead of
    // a generic "Replying to a message...".
    const replyIds = [...new Set((messages || []).map((m: any) => m.reply_to_id).filter(Boolean))] as string[]
    const replyMap = new Map<string, any>()
    if (replyIds.length) {
      const { data: parents } = await supabase
        .from("circle_room_messages")
        .select("id, content, media_url, message_type, author:profiles!circle_room_messages_author_id_fkey(display_name)")
        .in("id", replyIds)
      for (const p of parents || []) replyMap.set(p.id, p)
    }

    const hydrated = (messages || []).map((m: any) => ({
      ...m,
      reply_to: m.reply_to_id ? replyMap.get(m.reply_to_id) || null : null,
    }))

    return NextResponse.json({ success: true, messages: hydrated })
  } catch (error: any) {
    console.error("Community chat GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: communityId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Verify membership
    const { data: membership } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", communityId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "You must be a member to chat" }, { status: 403 })
    }

    // Check if user is muted (indefinitely, or until muted_until passes)
    const { data: memberData } = await supabase
      .from("circle_members")
      .select("is_muted, muted_until")
      .eq("circle_id", communityId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberData?.is_muted) {
      const until = memberData.muted_until ? new Date(memberData.muted_until) : null
      if (!until || until > new Date()) {
        return NextResponse.json(
          { error: until ? `You are muted until ${until.toLocaleString()}` : "You are muted in this community" },
          { status: 403 },
        )
      }
    }

    const body = await request.json()
    const content = String(body.content || "").trim()
    const spaceId = body.space_id || null
    const replyToId = body.reply_to_id || null
    const mediaUrl = body.media_url || null
    const mediaType = body.media_type || null
    // Message type drives UI rendering: text (default), image, gif, file.
    const messageType = ["text", "image", "gif", "file"].includes(body.message_type)
      ? body.message_type
      : mediaType === "image"
        ? "image"
        : mediaType === "video"
          ? "file"
          : "text"

    if (!content && !mediaUrl) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 })
    }

    if (content.length > 5000) {
      return NextResponse.json({ error: "Message is too long (max 5000 characters)" }, { status: 400 })
    }

    // Resolve room_id from space_id (or use the default "general" room)
    let roomId: number | null = null
    if (spaceId) {
      const { data: room } = await supabase
        .from("circle_rooms")
        .select("id")
        .eq("circle_id", communityId)
        .eq("id", spaceId)
        .maybeSingle()
      if (room) roomId = room.id
    }
    if (!roomId) {
      const { data: defaultRoom } = await supabase
        .from("circle_rooms")
        .select("id")
        .eq("circle_id", communityId)
        .eq("name", "general")
        .maybeSingle()
      if (defaultRoom) roomId = defaultRoom.id
    }
    if (!roomId) {
      // Create a default general room if none exists
      const { data: newRoom } = await supabase
        .from("circle_rooms")
        .insert({
          circle_id: communityId,
          name: "general",
          type: "chat",
          created_by: user.id,
        })
        .select("id")
        .single()
      if (newRoom) roomId = newRoom.id
    }

    if (!roomId) {
      return NextResponse.json({ error: "Could not find or create a chat room" }, { status: 500 })
    }

    const { data: message, error } = await supabase
      .from("circle_room_messages")
      .insert({
        room_id: roomId,
        author_id: user.id,
        content: content || null,
        media_url: mediaUrl,
        media_type: mediaType,
        message_type: messageType,
        reply_to_id: replyToId,
      })
      .select(`
        id,
        content,
        media_url,
        media_type,
        message_type,
        room_id,
        author_id,
        reply_to_id,
        reactions,
        is_edited,
        is_bot,
        bot_name,
        created_at,
        author:profiles!circle_room_messages_author_id_fkey(
          id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_organization, is_premium, badge_id
        )
      `)
      .single()

    if (error) {
      console.error("Community chat send error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Community notifications: reply-to (directed), mentions (@handle), and
    // an ambient "new message" ping for recent participants. All best-effort.
    try {
      const senderName =
        (message as any).author?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Someone"
      const chatUrl = `/communities/${communityId}?tab=chat`

      // 1. Directed reply notification
      if (replyToId) {
        const { data: parent } = await supabase
          .from("circle_room_messages")
          .select("author_id")
          .eq("id", replyToId)
          .maybeSingle()
        if (parent?.author_id && parent.author_id !== user.id) {
          await notifyUser(supabase, {
            userId: parent.author_id,
            type: "chat_message",
            title: "New reply in chat",
            message: `${senderName} replied: "${(content || "media").slice(0, 80)}"`,
            actionUrl: chatUrl,
            actorId: user.id,
            pushCategory: "directMessages",
            data: { communityId, messageId: message.id, reply_to_id: replyToId },
          })
        }
      }

      // 2. Mentions in chat
      const { processMentions } = await import("@/lib/mentions")
      if (content) {
        await processMentions(supabase, content, {
          source: "circle_room",
          circle_id: communityId,
          room_id: String(roomId),
          actor_id: user.id,
          actor_username: user.user_metadata?.username,
          actor_display_name: senderName,
          href: chatUrl,
        })
      }

      // 3. Ambient "chat woke up" ping — only when the room has been quiet for
      // 5+ minutes, so active conversations never flood notification rows.
      if (!replyToId && !content?.includes("@")) {
        const { data: lastMsg } = await supabase
          .from("circle_room_messages")
          .select("created_at, author_id")
          .eq("room_id", roomId)
          .lt("created_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        const quietForMs = lastMsg ? Date.now() - new Date(lastMsg.created_at).getTime() : Infinity
        const { data: recent } = quietForMs >= 5 * 60 * 1000
          ? await supabase
              .from("circle_room_messages")
              .select("author_id")
              .eq("room_id", roomId)
              .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
          : { data: [] }
        const targets = [
          ...new Set(
            (recent || [])
              .map((r: any) => r.author_id)
              .filter((aid: string | null) => aid && aid !== user.id),
          ),
        ].slice(0, 10) as string[]
        if (targets.length) {
          const { notifyUsers } = await import("@/lib/notifications")
          await notifyUsers(supabase, targets, {
            type: "chat_message",
            title: "New message in chat",
            message: `${senderName}: "${(content || "sent media").slice(0, 80)}"`,
            actionUrl: chatUrl,
            actorId: user.id,
            pushCategory: "directMessages",
            priority: "low",
            data: { communityId, messageId: message.id },
          })
        }
      }
    } catch (notifError) {
      console.warn("chat notification error:", notifError)
    }

    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    console.error("Community chat POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH — toggle a reaction on a chat message.
 * Body: { message_id, emoji }
 * Reactions are stored as { "<emoji>": ["<user_id>", ...] } in the JSONB
 * `reactions` column, so no extra table is needed for this volume.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: communityId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    const { data: membership } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", communityId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: "You must be a member to react" }, { status: 403 })
    }

    const { message_id: messageId, emoji } = await request.json()
    if (!messageId || !emoji || typeof emoji !== "string" || emoji.length > 8) {
      return NextResponse.json({ error: "message_id and emoji are required" }, { status: 400 })
    }

    // Load the message's current reactions (also verifies the message belongs
    // to a room in this community).
    const { data: rooms } = await supabase
      .from("circle_rooms")
      .select("id")
      .eq("circle_id", communityId)
    const roomIds = (rooms || []).map((r: any) => r.id)
    if (!roomIds.length) return NextResponse.json({ error: "No rooms" }, { status: 404 })

    const { data: message, error: fetchError } = await supabase
      .from("circle_room_messages")
      .select("id, reactions")
      .eq("id", messageId)
      .in("room_id", roomIds)
      .maybeSingle()

    if (fetchError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const current: Record<string, string[]> =
      message.reactions && typeof message.reactions === "object" && !Array.isArray(message.reactions)
        ? message.reactions
        : {}
    const reactors = Array.isArray(current[emoji]) ? current[emoji] : []
    const has = reactors.includes(user.id)
    const next = { ...current }
    if (has) {
      const filtered = reactors.filter((uid) => uid !== user.id)
      if (filtered.length) next[emoji] = filtered
      else delete next[emoji]
    } else {
      next[emoji] = [...reactors, user.id]
    }

    const { error: updateError } = await supabase
      .from("circle_room_messages")
      .update({ reactions: next })
      .eq("id", messageId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, reactions: next, reacted: !has })
  } catch (error: any) {
    console.error("Community chat reaction error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
