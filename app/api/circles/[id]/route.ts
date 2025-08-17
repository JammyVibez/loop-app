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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    const currentUser = token ? await getUserFromToken(token) : null

    const circleId = params.id

    // Fetch circle details with owner info
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified, is_premium),
        member_count:circle_members(count),
        members:circle_members!inner(
          user:profiles(id, username, display_name, avatar_url, is_verified, is_premium, last_active),
          role,
          joined_at
        )
      `)
      .eq("id", circleId)
      .single()

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Check if current user is a member
    let isMember = false
    let userRole = "guest"
    
    if (currentUser) {
      const { data: memberData } = await supabase
        .from("circle_members")
        .select("role, status")
        .eq("circle_id", circleId)
        .eq("user_id", currentUser.id)
        .single()
      
      if (memberData && memberData.status === "active") {
        isMember = true
        userRole = memberData.role
      }
    }

    // Get recent posts
    const { data: posts } = await supabase
      .from("circle_posts")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(20)

    // Get upcoming events
    const { data: events } = await supabase
      .from("circle_events")
      .select("*")
      .eq("circle_id", circleId)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5)

    // Get rooms
    const { data: rooms } = await supabase
      .from("circle_rooms")
      .select("*")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })

    return NextResponse.json({
      success: true,
      circle: {
        ...circle,
        is_member: isMember,
        user_role: userRole,
        stats: {
          member_count: circle.member_count,
          post_count: circle.post_count,
          room_count: rooms?.length || 0,
          event_count: events?.length || 0
        }
      },
      posts: posts || [],
      events: events || [],
      rooms: rooms || []
    })
  } catch (error) {
    console.error("Error fetching circle details:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    // Check if user has permission to edit (owner or admin)
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .single()

    if (!member) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { 
      name, 
      description, 
      category, 
      is_private, 
      avatar_url, 
      banner_url,
      rules,
      tags
    } = await request.json()

    // Update circle
    const { data: updatedCircle, error: updateError } = await supabase
      .from("circles")
      .update({
        name: name?.trim(),
        description: description?.trim(),
        category,
        is_private,
        avatar_url,
        banner_url,
        rules,
        tags,
        updated_at: new Date().toISOString()
      })
      .eq("id", circleId)
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url)
      `)
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update circle" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      circle: updatedCircle
    })
  } catch (error) {
    console.error("Error updating circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    // Check if user is the owner
    const { data: circle } = await supabase
      .from("circles")
      .select("owner_id")
      .eq("id", circleId)
      .single()

    if (!circle || circle.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the owner can delete the circle" }, { status: 403 })
    }

    // Delete circle (this will cascade delete related records due to foreign key constraints)
    const { error: deleteError } = await supabase
      .from("circles")
      .delete()
      .eq("id", circleId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete circle" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Circle deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
