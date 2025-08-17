
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const supabase = createServerClient()

    // Verify user is part of conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('participant_ids')
      .eq('id', params.conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    if (!conversation.participant_ids.includes(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url, is_verified)
      `)
      .eq('conversation_id', params.conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Messages fetch error:', error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      hasMore: messages.length === limit
    })

  } catch (error: any) {
    console.error("Error fetching messages:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } }
) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { content, message_type = 'text', media_url, reply_to_id } = await request.json()

    if (!content && !media_url) {
      return NextResponse.json({ error: "Message content or media required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Verify user is part of conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('participant_ids')
      .eq('id', params.conversationId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    if (!conversation.participant_ids.includes(user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: params.conversationId,
        sender_id: user.id,
        content,
        message_type,
        media_url,
        reply_to_id
      })
      .select(`
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url, is_verified)
      `)
      .single()

    if (messageError) {
      console.error('Message creation error:', messageError)
      return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', params.conversationId)

    return NextResponse.json({
      success: true,
      message
    })

  } catch (error: any) {
    console.error("Error creating message:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    )
  }
}
