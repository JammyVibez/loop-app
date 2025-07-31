import { type NextRequest, NextResponse } from "next/server"

function getUserFromToken(token: string) {
  return {
    id: "1",
    username: "demo_user",
    display_name: "Demo User",
  }
}

// Mock conversations data
const mockConversations = [
  {
    id: "1",
    type: "direct",
    participants: [
      {
        id: "2",
        username: "storyteller",
        display_name: "Story Teller",
        avatar_url: "/placeholder.svg?height=40&width=40",
        is_online: true,
        last_seen: new Date(),
      },
    ],
    last_message: {
      id: "4",
      content: "That's a fascinating loop idea! Want to collaborate?",
      sender_id: "2",
      created_at: "2024-01-15T14:30:00Z",
    },
    unread_count: 2,
    created_at: "2024-01-10T00:00:00Z",
    updated_at: "2024-01-15T14:30:00Z",
  },
  {
    id: "2",
    type: "direct",
    participants: [
      {
        id: "3",
        username: "musicmaker",
        display_name: "Music Maker",
        avatar_url: "/placeholder.svg?height=40&width=40",
        is_online: false,
        last_seen: new Date("2024-01-15T13:45:00Z"),
      },
    ],
    last_message: {
      id: "8",
      content: "Thanks for the feedback on my audio loop!",
      sender_id: "3",
      created_at: "2024-01-15T12:15:00Z",
    },
    unread_count: 0,
    created_at: "2024-01-12T00:00:00Z",
    updated_at: "2024-01-15T12:15:00Z",
  },
]

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

    return NextResponse.json({
      success: true,
      conversations: mockConversations,
    })
  } catch (error) {
    console.error("Error fetching conversations:", error)
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

    const { participant_ids, type = "direct" } = await request.json()

    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length === 0) {
      return NextResponse.json(
        {
          error: "Participant IDs are required",
        },
        { status: 400 },
      )
    }

    const newConversation = {
      id: Date.now().toString(),
      type,
      participants: participant_ids.map((id) => ({
        id,
        username: `user_${id}`,
        display_name: `User ${id}`,
        avatar_url: "/placeholder.svg?height=40&width=40",
        is_online: Math.random() > 0.5,
        last_seen: new Date(),
      })),
      last_message: null,
      unread_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      conversation: newConversation,
    })
  } catch (error) {
    console.error("Error creating conversation:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
