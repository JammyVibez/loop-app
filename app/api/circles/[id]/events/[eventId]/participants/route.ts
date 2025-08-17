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

// Get event participants
export async function GET(request: NextRequest, { params }: { params: { id: string, eventId: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const status = searchParams.get("status") // registered, attended, no_show

    const circleId = params.id
    const eventId = params.eventId

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

    let query = supabase
      .from("event_attendees")
      .select(`
        *,
        user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .eq("event_id", eventId)
      .order("registered_at", { ascending: true })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq("status", status)
    }

    const { data: participants, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      participants: participants || [],
      hasMore: participants?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching event participants:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Register for an event
export async function POST(request: NextRequest, { params }: { params: { id: string, eventId: string } }) {
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
    const eventId = params.eventId

    // Check if event exists
    const { data: event } = await supabase
      .from("circle_events")
      .select("id, max_participants")
      .eq("id", eventId)
      .eq("circle_id", circleId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
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
      return NextResponse.json({ error: "You must be a member to register for events" }, { status: 403 })
    }

    // Check if user is already registered
    const { data: existingRegistration } = await supabase
      .from("event_attendees")
      .select("id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single()

    if (existingRegistration) {
      return NextResponse.json({ error: "You are already registered for this event" }, { status: 400 })
    }

    // Check if event is full
    if (event.max_participants) {
      const { count: currentParticipants } = await supabase
        .from("event_attendees")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "registered")

      if (currentParticipants && currentParticipants >= event.max_participants) {
        return NextResponse.json({ error: "Event is full" }, { status: 400 })
      }
    }

    // Register user for event
    const { data: registration, error: insertError } = await supabase
      .from("event_attendees")
      .insert({
        event_id: eventId,
        user_id: user.id,
        status: "registered",
        registered_at: new Date().toISOString()
      })
      .select(`
        *,
        user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to register for event" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      registration,
      message: "Successfully registered for event"
    })
  } catch (error) {
    console.error("Error registering for event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update participant status (admin/moderator only)
export async function PUT(request: NextRequest, { params }: { params: { id: string, eventId: string } }) {
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
    const eventId = params.eventId
    const { participantId, status } = await request.json()

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

    // Check if user has admin/moderator permissions
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "moderator"])
      .single()

    if (!member) {
      return NextResponse.json({ error: "Insufficient permissions to update participant status" }, { status: 403 })
    }

    // Validate status
    const validStatuses = ["registered", "attended", "no_show"]
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Update participant status
    const { data: updatedParticipant, error: updateError } = await supabase
      .from("event_attendees")
      .update({
        status,
        attended_at: status === "attended" ? new Date().toISOString() : undefined
      })
      .eq("id", participantId)
      .eq("event_id", eventId)
      .select(`
        *,
        user:profiles!user_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update participant status" }, { status: 500 })
    }

    if (!updatedParticipant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      participant: updatedParticipant,
      message: `Participant status updated to ${status}`
    })
  } catch (error) {
    console.error("Error updating participant status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Unregister from an event
export async function DELETE(request: NextRequest, { params }: { params: { id: string, eventId: string } }) {
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
    const eventId = params.eventId
    const { searchParams } = new URL(request.url)
    const participantId = searchParams.get("participantId")

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

    // Check if user is the participant or has admin permissions
    let query = supabase
      .from("event_attendees")
      .select("user_id")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .single()

    if (participantId) {
      // Admin is specifying a specific participant
      query = supabase
        .from("event_attendees")
        .select("user_id")
        .eq("id", participantId)
        .eq("event_id", eventId)
        .single()
    }

    const { data: participant } = await query

    if (!participant) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Check if user is the participant or has admin permissions
    let hasPermission = participant.user_id === user.id

    if (!hasPermission) {
      const { data: member } = await supabase
        .from("circle_members")
        .select("role")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin", "moderator"])
        .single()

      hasPermission = !!member
    }

    if (!hasPermission) {
      return NextResponse.json({ error: "You can only unregister yourself or participants in circles where you have moderator permissions" }, { status: 403 })
    }

    // Delete registration
    let deleteQuery = supabase
      .from("event_attendees")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id)

    if (participantId) {
      deleteQuery = supabase
        .from("event_attendees")
        .delete()
        .eq("id", participantId)
        .eq("event_id", eventId)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to unregister from event" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Successfully unregistered from event"
    })
  } catch (error) {
    console.error("Error unregistering from event:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
