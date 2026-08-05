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

async function requireCircleAdmin(circleId: string, userId: string) {
  const { data: member } = await supabase
    .from("circle_members")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .in("role", ["owner", "admin", "moderator"])
    .maybeSingle()
  return Boolean(member)
}

// List who has access to a private room
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  try {
    const { id: circleId, roomId } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    if (!(await requireCircleAdmin(circleId, user.id))) {
      return NextResponse.json({ error: "Only circle admins can view channel access" }, { status: 403 })
    }

    const { data: grants, error } = await supabase
      .from("circle_room_members")
      .select("user_id, created_at, profile:profiles!user_id(id, username, display_name, avatar_url)")
      .eq("room_id", roomId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, members: grants || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// Grant a circle member access to a private room
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  try {
    const { id: circleId, roomId } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    if (!(await requireCircleAdmin(circleId, user.id))) {
      return NextResponse.json({ error: "Only circle admins can manage channel access" }, { status: 403 })
    }

    const { userId: targetUserId } = await request.json()
    if (!targetUserId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const { data: targetMember } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", targetUserId)
      .in("status", ["active", "approved"])
      .maybeSingle()
    if (!targetMember) {
      return NextResponse.json({ error: "That user isn't a member of this circle" }, { status: 400 })
    }

    const { error } = await supabase
      .from("circle_room_members")
      .upsert({ room_id: roomId, user_id: targetUserId, added_by: user.id }, { onConflict: "room_id,user_id" })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: "Access granted" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

// Revoke access
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; roomId: string }> }) {
  try {
    const { id: circleId, roomId } = await params
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    if (!(await requireCircleAdmin(circleId, user.id))) {
      return NextResponse.json({ error: "Only circle admins can manage channel access" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("userId")
    if (!targetUserId) return NextResponse.json({ error: "userId is required" }, { status: 400 })

    const { error } = await supabase
      .from("circle_room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: "Access revoked" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
