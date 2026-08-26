import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

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
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { action, status, is_live } = body

    // Fetch the event + host/admin check once — every mod action needs it.
    const { data: eventRow } = await supabase
      .from("events")
      .select("id, host_id, status")
      .eq("id", id)
      .maybeSingle()

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()

    const isHost = Boolean(eventRow && eventRow.host_id === user.id)
    const isAdmin = Boolean(adminProfile?.is_admin)
    if (!isHost && !isAdmin) {
      return NextResponse.json({ error: "Only the host or an admin can manage this event" }, { status: 403 })
    }

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

    if (action === "mute_all") {
      // Stage-wide mute: everyone on the roster is muted, and a NULL-user
      // mute row keeps newly joined participants muted until unmuted.
      await supabase.from("event_mutes").upsert(
        { event_id: id, user_id: null, muted_by: user.id },
        { onConflict: "event_id,user_id" },
      )
      await supabase
        .from("event_participants")
        .update({ is_muted: true, muted_at: new Date().toISOString() })
        .eq("event_id", id)

      return NextResponse.json({ success: true, message: "Everyone on stage has been muted." })
    }

    if (action === "unmute_all") {
      await supabase
        .from("event_mutes")
        .delete()
        .eq("event_id", id)
        .is("user_id", null)
      await supabase
        .from("event_participants")
        .update({ is_muted: false, muted_at: null })
        .eq("event_id", id)

      return NextResponse.json({ success: true, message: "Everyone on stage has been unmuted." })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("PATCH /api/events/[id] error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
