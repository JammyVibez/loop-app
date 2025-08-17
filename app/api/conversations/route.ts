import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

async function getUserFromToken(supabaseUrl: string, supabaseKey: string, token: string) {
  const supabase = createClient(supabaseUrl, supabaseKey)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

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

    const { data: conversations, error } = await supabase
      .from("conversations")
      .select(`
        *,
        participants:conversation_participants(
          user:profiles(*)
        ),
        last_message:messages(
          id,
          content,
          sender_id,
          created_at,
          sender:profiles(*)
        )
      `)
      .eq("conversation_participants.user_id", user.id)
      .order("updated_at", { ascending: false })

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      conversations: conversations || [],
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
    const supabase = createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token)
    if (userError || !user) {
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

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        type,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (convError) {
      console.error("Error creating conversation:", convError)
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
    }

    const participantData = [user.id, ...participant_ids].map((userId) => ({
      conversation_id: conversation.id,
      user_id: userId,
      joined_at: new Date().toISOString(),
    }))

    const { error: participantError } = await supabase.from("conversation_participants").insert(participantData)

    if (participantError) {
      console.error("Error adding participants:", participantError)
      return NextResponse.json({ error: "Failed to add participants" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      conversation,
    })
  } catch (error) {
    console.error("Error creating conversation:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
