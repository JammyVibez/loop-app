import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

async function getUserFromToken(token: string) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// List attendees + current user's RSVP status
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  try {
    const { eventId } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    const user = token ? await getUserFromToken(token) : null

    const { data: participants, error } = await supabase
      .from("circle_event_participants")
      .select("user_id, status, created_at, profile:profiles!user_id(id, username, display_name, avatar_url)")
      .eq("event_id", eventId)
      .eq("status", "attending")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const isAttending = user ? (participants || []).some((p: any) => p.user_id === user.id) : false

    return NextResponse.json({
      success: true,
      attendee_count: participants?.length || 0,
      participants: participants || [],
      is_attending: isAttending,
    })
  } catch (error: any) {
    console.error("Event participants GET error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// RSVP to an event
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  try {
    const { id: circleId, eventId } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("status", ["active", "approved"])
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "You must be a circle member to RSVP" }, { status: 403 })

    const { data: event } = await supabase
      .from("circle_events")
      .select("max_participants")
      .eq("id", eventId)
      .eq("circle_id", circleId)
      .maybeSingle()
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

    if (event.max_participants) {
      const { count } = await supabase
        .from("circle_event_participants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "attending")
      if ((count || 0) >= event.max_participants) {
        return NextResponse.json({ error: "This event is full" }, { status: 400 })
      }
    }

    const { error } = await supabase
      .from("circle_event_participants")
      .upsert({ event_id: eventId, user_id: user.id, status: "attending" }, { onConflict: "event_id,user_id" })

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to RSVP" }, { status: 500 })
    }

    await supabase
      .from("circle_events")
      .update({ participant_count: ((await supabase.from("circle_event_participants").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "attending")).count || 0) })
      .eq("id", eventId)

    return NextResponse.json({ success: true, message: "RSVP confirmed" })
  } catch (error: any) {
    console.error("Event RSVP POST error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// Cancel RSVP
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; eventId: string }> }) {
  try {
    const { eventId } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { error } = await supabase
      .from("circle_event_participants")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to cancel RSVP" }, { status: 500 })
    }

    const { count } = await supabase
      .from("circle_event_participants")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("status", "attending")
    await supabase.from("circle_events").update({ participant_count: count || 0 }).eq("id", eventId)

    return NextResponse.json({ success: true, message: "RSVP cancelled" })
  } catch (error: any) {
    console.error("Event RSVP DELETE error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
