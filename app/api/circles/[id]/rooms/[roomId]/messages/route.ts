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

// Get room messages
export async function GET(request: NextRequest, { params }: { params: { id: string, roomId: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const before = searchParams.get("before") // cursor for pagination

    const circleId = params.id
    const roomId = params.roomId

    // Check if room exists and user has access
    const { data: room } = await supabase
      .from("circle_rooms")
      .select("id")
      .eq("id", roomId)
      .eq("circle_id", circleId)
      .single()

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Check if user is a member of the circle
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    if (!member) {
      return NextResponse.json({ error: "You must be a member to view messages" }, { status: 403 })
    }

    let query = supabase
      .from("circle_room_messages")
      .select("*, author:profiles!inner(id, username, display_name, avatar_url, is_verified, is_premium)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (before) {
      query = query.lt("created_at", before)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    // Reverse messages to show oldest first
    const sortedMessages = messages?.reverse() || []

    return NextResponse.json({
      success: true,
      messages: sortedMessages || [],
      hasMore: messages?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching room messages:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Send a message
export async function POST(request: NextRequest, { params }: { params: { id: string, roomId: string } }) {
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
    const { content, media_url, media_type } = await request.json()

    // Check if room exists
    const { data: room } = await supabase
      .from("circle_rooms")
      .select("id")
      .eq("id", roomId)
      .eq("circle_id", circleId)
      .single()

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
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
      return NextResponse.json({ error: "You must be a member to send messages" }, { status: 403 })
    }

    // Validate content
    if (!content?.trim() && !media_url) {
      return NextResponse.json({ error: "Content or media is required" }, { status: 400 })
    }

    // Create message
    const { data: message, error: insertError } = await supabase
      .from("circle_room_messages")
      .insert({
        room_id: roomId,
        author_id: user.id,
        content: content?.trim() || "",
        media_url,
        media_type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select("*, author:profiles!inner(id, username, display_name, avatar_url, is_verified, is_premium)")
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: message,
      info: "Message sent successfully"
    })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update a message
export async function PUT(request: NextRequest, { params }: { params: { id: string, roomId: string } }) {
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
    const { messageId, content, media_url, media_type } = await request.json()

    // Check if message exists and user is the author
    const { data: message } = await supabase
      .from("circle_room_messages")
      .select("author_id")
      .eq("id", messageId)
      .eq("room_id", roomId)
      .single()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    if (message.author_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 })
    }

    // Update message
    const { data: updatedMessage, error: updateError } = await supabase
      .from("circle_room_messages")
      .update({
        content: content?.trim() || "",
        media_url,
        media_type,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)
      .select("*, author:profiles!inner(id, username, display_name, avatar_url, is_verified, is_premium)")
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update message" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedMessage,
      info: "Message updated successfully"
    })
  } catch (error) {
    console.error("Error updating message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete a message
export async function DELETE(request: NextRequest, { params }: { params: { id: string, roomId: string } }) {
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
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("messageId")

    if (!messageId) {
      return NextResponse.json({ error: "Message ID is required" }, { status: 400 })
    }

    // Check if message exists and user is the author or has admin permissions
    const { data: message } = await supabase
      .from("circle_room_messages")
      .select("author_id")
      .eq("id", messageId)
      .eq("room_id", roomId)
      .single()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if user is author or has admin/moderator permissions
    let hasPermission = message.author_id === user.id
    
    if (!hasPermission) {
      const { data: member } = await supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .in("role", ["admin", "moderator"])
        .single()
      
      hasPermission = !!member
    }

    if (!hasPermission) {
      return NextResponse.json({ error: "You can only delete your own messages or messages in circles where you have moderator permissions" }, { status: 403 })
    }

    // Delete message
    const { error: deleteError } = await supabase
      .from("circle_room_messages")
      .delete()
      .eq("id", messageId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      info: "Message deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting message:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
