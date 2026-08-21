import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"]

async function isStaffUser(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin, is_moderator")
    .eq("id", userId)
    .maybeSingle()
  return Boolean(data?.is_admin || data?.is_moderator)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get("ticketId")

    if (!ticketId) {
      return NextResponse.json({ error: "Ticket ID is required" }, { status: 400 })
    }

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("user_id, status")
      .eq("id", ticketId)
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const staff = await isStaffUser(supabase, user.id)
    if (!staff && ticket.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: messages, error } = await supabase
      .from("support_messages")
      .select(`
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url, video_avatar_url, is_admin, is_moderator)
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ messages: messages || [], ticket })
  } catch (error) {
    console.error("Support messages GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const ticketId = body.ticketId
    const message = String(body.message || "").trim()

    if (!ticketId || !message) {
      return NextResponse.json({ error: "ticketId and message are required" }, { status: 400 })
    }

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("user_id, status")
      .eq("id", ticketId)
      .maybeSingle()

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const staff = await isStaffUser(supabase, user.id)
    if (!staff && ticket.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: supportMsg, error } = await supabase
      .from("support_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        message,
        is_from_support: staff,
      })
      .select(`
        *,
        sender:profiles!sender_id(id, username, display_name, avatar_url, video_avatar_url, is_admin, is_moderator)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Bump the ticket so it surfaces at the top of both sides' lists
    await supabase.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId)

    return NextResponse.json({ success: true, message: supportMsg })
  } catch (error) {
    console.error("Support message POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const staff = await isStaffUser(supabase, user.id)
    if (!staff) {
      return NextResponse.json({ error: "Staff access required" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { ticketId, status } = body

    if (!ticketId || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "ticketId and a valid status are required" }, { status: 400 })
    }

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error("Support ticket PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
