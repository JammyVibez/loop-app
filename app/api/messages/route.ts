import { type NextRequest, NextResponse } from "next/server"

function getUserFromToken(token: string) {
  return {
    id: "1",
    username: "demo_user",
    display_name: "Demo User",
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get("conversation_id")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Mock messages data
    const mockMessages = [
      {
        id: "1",
        conversation_id: conversationId || "1",
        sender_id: "2",
        content: "Hey! I saw your time travel loop and it got me thinking...",
        message_type: "text",
        created_at: "2024-01-15T14:25:00Z",
        reactions: [{ user_id: "1", emoji: "👍", created_at: "2024-01-15T14:26:00Z" }],
        sender: {
          id: "2",
          username: "storyteller",
          display_name: "Story Teller",
          avatar_url: "/placeholder.svg?height=40&width=40",
        },
      },
      {
        id: "2",
        conversation_id: conversationId || "1",
        sender_id: "1",
        content: "Oh really? What did you think about?",
        message_type: "text",
        created_at: "2024-01-15T14:26:00Z",
        reactions: [],
        sender: {
          id: "1",
          username: "demo_user",
          display_name: "Demo User",
          avatar_url: "/placeholder.svg?height=40&width=40",
        },
      },
    ]

    return NextResponse.json({
      success: true,
      messages: mockMessages,
      has_more: false,
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
    const user = getUserFromToken(token)

    if (!user) {
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

    // In a real app, you would:
    // 1. Validate user has access to the conversation
    // 2. Insert message into database
    // 3. Emit real-time event to other participants
    // 4. Update conversation's last_message

    /*
    const message = await db.query(`
      INSERT INTO messages (conversation_id, sender_id, content, message_type, file_url, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `, [conversation_id, user.id, content, message_type, file_url])

    // Update conversation
    await db.query(`
      UPDATE conversations 
      SET last_message_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [message.rows[0].id, conversation_id])

    // Emit real-time event
    io.to(`conversation_${conversation_id}`).emit('new_message', {
      ...message.rows[0],
      sender: user
    })
    */

    const newMessage = {
      id: Date.now().toString(),
      conversation_id,
      sender_id: user.id,
      content,
      message_type,
      file_url,
      created_at: new Date().toISOString(),
      reactions: [],
      sender: user,
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
    })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
