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

// Get circle rooms
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const type = searchParams.get("type")

    const circleId = params.id

    let query = supabase
      .from("circle_rooms")
      .select("*")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (type) {
      query = query.eq("type", type)
    }

    const { data: rooms, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      rooms: rooms || [],
      hasMore: rooms?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching circle rooms:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Create a new room
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { name, description, type, is_private } = await request.json()

    // Check if user has permission to create rooms (member with appropriate role)
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "moderator"])
      .single()

    if (!member) {
      return NextResponse.json({ error: "Insufficient permissions to create rooms" }, { status: 403 })
    }

    // Validate room name
    if (!name?.trim()) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 })
    }

    // Validate room type
    const validTypes = ["text", "voice", "video"]
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid room type" }, { status: 400 })
    }

    // Create room
    const { data: room, error: insertError } = await supabase
      .from("circle_rooms")
      .insert({
        circle_id: circleId,
        name: name.trim(),
        description: description?.trim() || "",
        type,
        is_private: is_private || false,
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select("*")
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create room" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      room,
      message: "Room created successfully"
    })
  } catch (error) {
    console.error("Error creating circle room:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update a room
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { roomId, name, description, is_private } = await request.json()

    // Check if room exists and user has permission to update it
    const { data: room } = await supabase
      .from("circle_rooms")
      .select("created_by")
      .eq("id", roomId)
      .eq("circle_id", circleId)
      .single()

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Check if user is the creator or has admin permissions
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .single()

    const isCreator = room.created_by === user.id
    const isAdmin = !!member

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: "Insufficient permissions to update room" }, { status: 403 })
    }

    // Update room
    const { data: updatedRoom, error: updateError } = await supabase
      .from("circle_rooms")
      .update({
        name: name?.trim() || undefined,
        description: description?.trim() || undefined,
        is_private: typeof is_private !== 'undefined' ? is_private : undefined
      })
      .eq("id", roomId)
      .select("*")
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update room" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      room: updatedRoom,
      message: "Room updated successfully"
    })
  } catch (error) {
    console.error("Error updating circle room:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete a room
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("roomId")

    if (!roomId) {
      return NextResponse.json({ error: "Room ID is required" }, { status: 400 })
    }

    // Check if room exists and user has permission to delete it
    const { data: room } = await supabase
      .from("circle_rooms")
      .select("created_by")
      .eq("id", roomId)
      .eq("circle_id", circleId)
      .single()

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Check if user is the creator or has admin permissions
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .single()

    const isCreator = room.created_by === user.id
    const isAdmin = !!member

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: "Insufficient permissions to delete room" }, { status: 403 })
    }

    // Delete room
    const { error: deleteError } = await supabase
      .from("circle_rooms")
      .delete()
      .eq("id", roomId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete room" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Room deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting circle room:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
