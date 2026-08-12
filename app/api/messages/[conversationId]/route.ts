import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch (error) {
    console.error("Auth error:", error)
    return null
  }
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await params
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const supabase = createServerClient()
    if (!(await assertMember(supabase, conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url, is_verified)
      `,
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Messages fetch error:", error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messages: (messages || []).reverse(),
      hasMore: (messages || []).length === limit,
    })
  } catch (error: any) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await params
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { content, message_type = "text", media_url, reply_to_id } = await request.json()
    if (!content && !media_url) {
      return NextResponse.json({ error: "Message content or media required" }, { status: 400 })
    }

    const supabase = createServerClient()
    if (!(await assertMember(supabase, conversationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        author_id: user.id,
        content,
        message_type,
        media_url,
        reply_to_id,
      })
      .select(
        `
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url, is_verified)
      `,
      )
      .single()

    if (messageError) {
      console.error("Message creation error:", messageError)
      return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
    }

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)

    // Notify other participants (in-app + real Web Push)
    try {
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .is("left_at", null)

      const sender = Array.isArray(message.sender) ? message.sender[0] : message.sender
      const preview = String(content || (media_url ? "Sent an attachment" : "New message")).slice(0, 120)
      const { notifyUser } = await import("@/lib/notifications")
      await Promise.all(
        (participants || [])
          .map((p: any) => p.user_id)
          .filter((id: string) => id && id !== user.id)
          .map((recipientId: string) =>
            notifyUser(supabase, {
              userId: recipientId,
              type: "message",
              title: sender?.display_name || sender?.username || "New message",
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

    const text = String(content || "").trim()
    if (text) {
      try {
        const { processMentions, extractMentions } = await import("@/lib/mentions")
        if (extractMentions(text).length) {
          const sender = Array.isArray(message.sender) ? message.sender[0] : message.sender
          await processMentions(supabase, text, {
            source: "message",
            conversation_id: conversationId,
            actor_id: user.id,
            actor_username: sender?.username,
            actor_display_name: sender?.display_name,
            href: `/messages?c=${conversationId}`,
          })
        }
      } catch (err) {
        console.error("message mentions:", err)
      }
    }

    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    console.error("Error creating message:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
