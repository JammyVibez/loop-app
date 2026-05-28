import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
  if (!token) return null
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function getMember(circleId: string, userId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("circle_members")
    .select("role, status")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle()
  return data
}

function canManage(role?: string) {
  return role === "owner" || role === "admin" || role === "moderator"
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  const { roomId } = await params
  const supabase = createServerClient()
  const { data: presence, error } = await supabase.from("circle_room_presence").select("*, user:profiles(id, username, display_name, avatar_url)").eq("room_id", roomId).gte("last_seen_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, presence: presence || [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id, roomId } = await params
  const member = await getMember(id, user.id)
  if (!member || !["active", "approved"].includes(member.status)) return NextResponse.json({ error: "You must be a member" }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const supabase = createServerClient()
  const { data: presence, error } = await supabase.from("circle_room_presence").upsert({
    room_id: roomId,
    circle_id: id,
    user_id: user.id,
    media_state: body.media_state || {},
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "room_id,user_id" }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, presence })
}
