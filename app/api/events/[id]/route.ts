import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServerClient()

    let { data: event, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !event) {
      // Official platform-wide events live in global_events
      const { data: globalEvent, error: globalError } = await supabase
        .from("global_events")
        .select("*")
        .eq("id", id)
        .maybeSingle()

      if (globalError || !globalEvent) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 })
      }

      event = {
        ...globalEvent,
        host_id: null,
        host_name: "Loop Official",
        host_avatar: "",
        start_time: globalEvent.starts_at || globalEvent.start_time,
        cover_image: globalEvent.banner_url || globalEvent.cover_image,
        participants_count: globalEvent.rsvp_count || 0,
      }
    }

    const { data: participants } = await supabase
      .from("event_participants")
      .select("*")
      .eq("event_id", id)

    const { data: rsvps } = await supabase
      .from("event_rsvps")
      .select("user_id")
      .eq("event_id", id)

    return NextResponse.json({
      success: true,
      event,
      participants: participants || [],
      rsvp_count: (rsvps || []).length,
      rsvps: rsvps || [],
    })
  } catch (error: any) {
    console.error("GET /api/events/[id] error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { action, status, is_live } = body

    if (action === "end_event" || status === "ended") {
      const { data: updatedEvent, error } = await supabase
        .from("events")
        .update({
          status: "ended",
          is_live: false,
          ended_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Also update global_events table if matching
      await supabase
        .from("global_events")
        .update({ is_active: false })
        .eq("id", id)

      return NextResponse.json({
        success: true,
        message: "Event has been ended.",
        event: updatedEvent
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("PATCH /api/events/[id] error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
