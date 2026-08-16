import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

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

/** Poll option ids are short random strings stored in the options JSONB. */
function optionId() {
  return Math.random().toString(36).slice(2, 8)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> },
) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromToken(authHeader.replace("Bearer ", ""))
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { id: circleId, roomId } = await params
    const { data: member } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("status", ["active", "approved"])
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "You must be a member to view polls" }, { status: 403 })

    const { data: polls, error } = await supabase
      .from("circle_room_polls")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, polls: polls || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> },
) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromToken(authHeader.replace("Bearer ", ""))
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { id: circleId, roomId } = await params
    const body = await request.json().catch(() => ({}))
    const question = String(body.question || "").trim()
    const rawOptions: unknown[] = Array.isArray(body.options) ? body.options : []
    const durationHours = Number(body.durationHours) || 24

    if (!question || question.length > 200) {
      return NextResponse.json({ error: "Poll question is required (max 200 chars)" }, { status: 400 })
    }
    const options = rawOptions
      .map((o) => String((o as any)?.text ?? o ?? "").trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((text) => ({ id: optionId(), text: text.slice(0, 120), votes: 0 }))
    if (options.length < 2) {
      return NextResponse.json({ error: "Add at least 2 options" }, { status: 400 })
    }

    const { data: room } = await supabase
      .from("circle_rooms")
      .select("id, type, is_private")
      .eq("id", roomId)
      .eq("circle_id", circleId)
      .maybeSingle()
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 })

    const { data: member } = await supabase
      .from("circle_members")
      .select("id, role, permissions")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("status", ["active", "approved"])
      .maybeSingle()
    if (!member) return NextResponse.json({ error: "You must be a member to create a poll" }, { status: 403 })

    const isCircleAdmin = ["owner", "admin", "moderator"].includes(member.role)
    if (room.type === "announcement" && !isCircleAdmin && !member.permissions?.can_post_announcements) {
      return NextResponse.json({ error: "Only circle admins can post in an announcement channel" }, { status: 403 })
    }

    // The poll lives on a chat message so it renders inline in the stream.
    const { data: message, error: msgErr } = await supabase
      .from("circle_room_messages")
      .insert({
        room_id: roomId,
        author_id: user.id,
        content: `📊 Poll: ${question}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single()
    if (msgErr || !message) {
      return NextResponse.json({ error: msgErr?.message || "Failed to post poll" }, { status: 500 })
    }

    const endsAt =
      durationHours > 0 ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString() : null

    const { data: poll, error: pollErr } = await supabase
      .from("circle_room_polls")
      .insert({
        room_id: roomId,
        message_id: message.id,
        question,
        options,
        total_votes: 0,
        created_by: user.id,
        ends_at: endsAt,
        ended: false,
      })
      .select()
      .single()
    if (pollErr || !poll) {
      await supabase.from("circle_room_messages").delete().eq("id", message.id)
      return NextResponse.json({ error: pollErr?.message || "Failed to create poll" }, { status: 500 })
    }

    return NextResponse.json({ success: true, poll, message_id: message.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
