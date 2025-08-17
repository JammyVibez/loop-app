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

// Get circle events
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const status = searchParams.get("status") // upcoming, past, ongoing
    const type = searchParams.get("type") // discussion, voice_chat, screen_share, game

    const circleId = params.id

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

// Create a new event
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
    const { 
      title, 
      description, 
      event_type, 
      starts_at, 
      ends_at, 
      max_participants,
      is_recurring,
      recurrence_pattern
    } = await request.json()

    // Check if user has permission to create events (member with appropriate role)
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "moderator"])
      .single()

    if (!member) {
      return NextResponse.json({ error: "Insufficient permissions to create events" }, { status: 403 })
    }

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json({ error: "Event title is required" }, { status: 400 })
    }

    if (!starts_at) {
      return NextResponse.json({ error: "Start time is required" }, { status: 400 })
    }

    // Validate event type
    const validTypes = ["discussion", "voice_chat", "screen_share", "game"]
    if (!event_type || !validTypes.includes(event_type)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 })
    }

    // Validate date range
    if (ends_at && new Date(starts_at) >= new Date(ends_at)) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 })
    }

    // Create event
    const { data: event, error: insertError } = await supabase
      .from("circle_events")
      .insert({
        circle_id: circleId,
        organizer_id: user.id,
        title: title.trim(),
        description: description?.trim() || "",
        event_type,
        starts_at,
        ends_at,
        max_participants: max_participants || 50,
        is_recurring: is_recurring || false,
        recurrence_pattern: recurrence_pattern || null,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        organizer:profiles!organizer_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      event,
      message: "Event created successfully"
    })
  } catch (error) {
    console.error("Error creating circle event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update an event
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
    const { 
      eventId, 
      title, 
      description, 
      event_type, 
      starts_at, 
      ends_at, 
      max_participants,
      is_recurring,
      recurrence_pattern
    } = await request.json()

    // Check if event exists and user has permission to update it
    const { data: event } = await supabase
      .from("circle_events")
      .select("organizer_id")
      .eq("id", eventId)
      .eq("circle_id", circleId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check if user is the organizer or has admin permissions
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .single()

    const isOrganizer = event.organizer_id === user.id
    const isAdmin = !!member

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Insufficient permissions to update event" }, { status: 403 })
    }

    // Update event
    const { data: updatedEvent, error: updateError } = await supabase
      .from("circle_events")
      .update({
        title: title?.trim() || undefined,
        description: description?.trim() || undefined,
        event_type: event_type || undefined,
        starts_at: starts_at || undefined,
        ends_at: ends_at || undefined,
        max_participants: typeof max_participants !== 'undefined' ? max_participants : undefined,
        is_recurring: typeof is_recurring !== 'undefined' ? is_recurring : undefined,
        recurrence_pattern: recurrence_pattern || undefined
      })
      .eq("id", eventId)
      .select(`
        *,
        organizer:profiles!organizer_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      message: "Event updated successfully"
    })
  } catch (error) {
    console.error("Error updating circle event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete an event
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
    const eventId = searchParams.get("eventId")

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    // Check if event exists and user has permission to delete it
    const { data: event } = await supabase
      .from("circle_events")
      .select("organizer_id")
      .eq("id", eventId)
      .eq("circle_id", circleId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Check if user is the organizer or has admin permissions
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .single()

    const isOrganizer = event.organizer_id === user.id
    const isAdmin = !!member

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json({ error: "Insufficient permissions to delete event" }, { status: 403 })
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
    console.error("Error deleting circle event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
