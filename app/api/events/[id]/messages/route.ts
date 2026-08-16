import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const supabase = createServerClient()

    const { data: messages, error } = await supabase
      .from("event_messages")
      .select(
        `
        id, content, created_at, user_id, is_deleted,
        author:profiles!user_id(id, username, display_name, avatar_url)
      `,
      )
      .eq("event_id", eventId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(200)

    if (error) {
      console.warn("Fetch event messages error:", error.message)
      return NextResponse.json({ success: true, messages: [] })
    }

    return NextResponse.json({ success: true, messages: messages || [] })
  } catch (error: any) {
    console.error("GET event messages error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Sign in to chat" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim().slice(0, 500)
    if (!content) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Mute enforcement: stage-wide mute (event_mutes user_id IS NULL) or an
    // individual mute (participant row or per-user mute row).
    const [{ data: allMute }, { data: userMute }, { data: participant }] = await Promise.all([
      supabase
        .from("event_mutes")
        .select("event_id")
        .eq("event_id", eventId)
        .is("user_id", null)
        .maybeSingle(),
      supabase
        .from("event_mutes")
        .select("event_id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("event_participants")
        .select("is_muted")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ])
    if (allMute || userMute || participant?.is_muted) {
      return NextResponse.json({ error: "You're muted in this event chat" }, { status: 403 })
    }

    const { data: message, error } = await supabase
      .from("event_messages")
      .insert({ event_id: eventId, user_id: user.id, content })
      .select(
        `
        id, content, created_at, user_id, is_deleted,
        author:profiles!user_id(id, username, display_name, avatar_url)
      `,
      )
      .single()

    if (error) {
      console.error("Insert event message error:", error)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message })
  } catch (error: any) {
    console.error("POST event message error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get("message_id")
    if (!messageId) {
      return NextResponse.json({ error: "message_id required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: message } = await supabase
      .from("event_messages")
      .select("id, user_id, event_id")
      .eq("id", messageId)
      .eq("event_id", eventId)
      .maybeSingle()

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Author can delete their own; hosts/mods/admins can moderate any message.
    const isAuthor = message.user_id === user.id
    const { data: eventRow } = await supabase
      .from("events")
      .select("host_id")
      .eq("id", eventId)
      .maybeSingle()
    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    const { data: actorParticipant } = await supabase
      .from("event_participants")
      .select("role")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
      .maybeSingle()

    const isMod = Boolean(
      eventRow?.host_id === user.id ||
        actorProfile?.is_admin ||
        actorParticipant?.role === "moderator",
    )

    if (!isAuthor && !isMod) {
      return NextResponse.json({ error: "You can't delete this message" }, { status: 403 })
    }

    // Soft-delete: keeps the audit trail and lets realtime clients drop the bubble.
    const { error } = await supabase
      .from("event_messages")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", messageId)

    if (error) {
      console.error("Delete event message error:", error)
      return NextResponse.json({ error: "Failed to delete message" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Message deleted" })
  } catch (error: any) {
    console.error("DELETE event message error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
