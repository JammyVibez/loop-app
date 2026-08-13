import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const getUser = getUserFromRequest

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
    const limit = Number.parseInt(searchParams.get("limit") || "80")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!(await assertMember(supabase, conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: messages, error } = await supabase
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
        is_edited,
        sender:profiles!messages_author_id_fkey(
          id, username, display_name, avatar_url
        )
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      // Fallback without join alias if FK name differs
      const fallback = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1)
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })

      const senderIds = Array.from(
        new Set((fallback.data || []).map((m) => m.author_id || m.sender_id).filter(Boolean)),
      )
      const { data: profiles } = senderIds.length
        ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", senderIds)
        : { data: [] as any[] }
      const map = new Map((profiles || []).map((p) => [p.id, p]))
      const hydrated = (fallback.data || []).map((m) => ({
        ...m,
        sender: map.get(m.author_id || m.sender_id) || null,
      }))
      return NextResponse.json({ success: true, messages: hydrated, has_more: false })
    }

    return NextResponse.json({ success: true, messages: messages || [], has_more: (messages || []).length === limit })
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

    if (!conversationId || (!content && !mediaUrl)) {
      return NextResponse.json({ error: "Conversation ID and content are required" }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!(await assertMember(supabase, conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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

    let message: any = null
    let messageError: any = null

    const withReply = replyToId ? { ...basePayload, reply_to_id: replyToId } : basePayload
    ;({ data: message, error: messageError } = await supabase.from("messages").insert(withReply).select("*").single())

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
      .select("id, username, display_name, avatar_url")
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

    try {
      await supabase.channel(`conversation:${conversationId}`).send({
        type: "broadcast",
        event: "new_message",
        payload: enriched,
      })
    } catch {}

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
        if (extractMentions(content).length) {
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
