import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const supabase = createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversation_id")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 })
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select(`
        *,
        sender:profiles(*),
        reactions:message_reactions(
          user_id,
          emoji,
          created_at,
          user:profiles(*)
        )
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)

    const hasMore = (count || 0) > offset + limit

    return NextResponse.json({
      success: true,
      messages: messages || [],
      has_more: hasMore,
    })
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const supabase = createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { conversation_id, content, message_type = "text", file_url } = await request.json()

    if (!conversation_id || !content) {
      return NextResponse.json(
        {
          error: "Conversation ID and content are required",
        },
        { status: 400 },
      )
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        sender_id: user.id,
        content,
        message_type,
        file_url,
        created_at: new Date().toISOString(),
      })
      .select(`
        *,
        sender:profiles(*)
      `)
      .single()

    if (messageError) {
      console.error("Error creating message:", messageError)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        last_message_id: message.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation_id)

    if (updateError) {
      console.error("Error updating conversation:", updateError)
    }

    const channel = supabase.channel(`conversation_${conversation_id}`)
    channel.send({
      type: "broadcast",
      event: "new_message",
      payload: message,
    })

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
