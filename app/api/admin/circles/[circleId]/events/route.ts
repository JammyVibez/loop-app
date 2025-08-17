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

// Get circle events (admin view)
export async function GET(request: NextRequest, { params }: { params: { circleId: string } }) {
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

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const status = searchParams.get("status") // upcoming, past, ongoing
    const type = searchParams.get("type") // discussion, voice_chat, screen_share, game
    const search = searchParams.get("search")

    const circleId = params.circleId

    // Check if circle exists
    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single()

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    let query = supabase
      .from("circle_events")
      .select(`
        *,
        organizer:profiles!organizer_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("circle_id", circleId)
      .order("starts_at", { ascending: true })
      .range(offset, offset + limit - 1)

    // Filter by status
    const now = new Date().toISOString()
    if (status === "upcoming") {
      query = query.gte("starts_at", now)
    } else if (status === "past") {
      query = query.lt("ends_at", now)
    } else if (status === "ongoing") {
      query = query.lte("starts_at", now).gte("ends_at", now)
    }

    if (type) {
      query = query.eq("event_type", type)
    }

    if (search) {
      query = query.ilike("title", `%${search}%`)
    }

    const { data: events, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      events: events || [],
      hasMore: events?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching circle events:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete an event (admin override)
export async function DELETE(request: NextRequest, { params }: { params: { circleId: string } }) {
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

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const circleId = params.circleId
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("eventId")

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    // Check if circle exists
    const { data: circle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single()

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Check if event exists
    const { data: event } = await supabase
      .from("circle_events")
      .select("id")
      .eq("id", eventId)
      .eq("circle_id", circleId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Delete event
    const { error: deleteError } = await supabase
      .from("circle_events")
      .delete()
      .eq("id", eventId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Event deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
