import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUserFromToken(token: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// Get message reactions
export async function GET(request: NextRequest, { params }: { params: { id: string, roomId: string, messageId: string } }) {
  try {
    const circleId = params.id
    const roomId = params.roomId
    const messageId = params.messageId

    // Check if message exists
    const { data: message } = await supabase
      .from("circle_room_messages")
      .select("id")
      .eq("id", messageId)
      .eq("room_id", roomId)
      .single()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Get reactions with user info
    const { data: reactions, error } = await supabase
      .from("circle_room_message_reactions")
      .select(`
        *,
        user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("message_id", messageId)

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 })
    }

    // Group reactions by type
    const reactionsByType: { [key: string]: any[] } = {}
    reactions?.forEach(reaction => {
      if (!reactionsByType[reaction.reaction_type]) {
        reactionsByType[reaction.reaction_type] = []
      }
      reactionsByType[reaction.reaction_type].push(reaction)
    })

    return NextResponse.json({
      success: true,
      reactions: reactionsByType,
      total: reactions?.length || 0
    })
  } catch (error) {
    console.error("Error fetching message reactions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Add or remove reaction
export async function POST(request: NextRequest, { params }: { params: { id: string, roomId: string, messageId: string } }) {
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

    const circleId = params.id
    const roomId = params.roomId
    const messageId = params.messageId
    const { reactionType } = await request.json()

    // Check if message exists
    const { data: message } = await supabase
      .from("circle_room_messages")
      .select("id")
      .eq("id", messageId)
      .eq("room_id", roomId)
      .single()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if user is a member of the circle
    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    if (!member) {
      return NextResponse.json({ error: "You must be a member to react to messages" }, { status: 403 })
    }

    // Validate reaction type
    if (!reactionType) {
      return NextResponse.json({ error: "Reaction type is required" }, { status: 400 })
    }

    // Check if user already reacted with this type
    const { data: existingReaction } = await supabase
      .from("circle_room_message_reactions")
      .select("id")
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("reaction_type", reactionType)
      .single()

    if (existingReaction) {
      // Remove reaction
      await supabase
        .from("circle_room_message_reactions")
        .delete()
        .eq("id", existingReaction.id)

      return NextResponse.json({
        success: true,
        action: "removed",
        info: "Reaction removed"
      })
    } else {
      // Add reaction
      const { data: reaction, error: insertError } = await supabase
        .from("circle_room_message_reactions")
        .insert({
          message_id: messageId,
          user_id: user.id,
          reaction_type: reactionType,
          created_at: new Date().toISOString()
        })
        .select(`
          *,
          user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium)
        `)
        .single()

      if (insertError) {
        console.error("Database insert error:", insertError)
        return NextResponse.json({ error: "Failed to add reaction" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        action: "added",
        reaction,
        info: "Reaction added"
      })
    }
  } catch (error) {
    console.error("Error reacting to message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete a specific reaction
export async function DELETE(request: NextRequest, { params }: { params: { id: string, roomId: string, messageId: string } }) {
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

    const circleId = params.id
    const roomId = params.roomId
    const messageId = params.messageId
    const { searchParams } = new URL(request.url)
    const reactionId = searchParams.get("reactionId")

    if (!reactionId) {
      return NextResponse.json({ error: "Reaction ID is required" }, { status: 400 })
    }

    // Check if reaction exists and user is the author
    const { data: reaction } = await supabase
      .from("circle_room_message_reactions")
      .select("user_id")
      .eq("id", reactionId)
      .eq("message_id", messageId)
      .single()

    if (!reaction) {
      return NextResponse.json({ error: "Reaction not found" }, { status: 404 })
    }

    if (reaction.user_id !== user.id) {
      return NextResponse.json({ error: "You can only delete your own reactions" }, { status: 403 })
    }

    // Delete reaction
    const { error: deleteError } = await supabase
      .from("circle_room_message_reactions")
      .delete()
      .eq("id", reactionId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete reaction" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      info: "Reaction deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting reaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
