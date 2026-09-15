import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/users/blocks
 * Returns the caller's blocked users (for settings UI / filtering).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("user_blocks")
      .select(`
        id,
        blocked_id,
        created_at,
        user:profiles!user_blocks_blocked_id_fkey(id, username, display_name, avatar_url)
      `)
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      blocked: (data || []).map((row: any) => ({
        id: row.id,
        blocked_at: row.created_at,
        user: row.user,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/users/blocks  { target_user_id, action: "block" | "unblock" }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const targetUserId = body.target_user_id || body.user_id
    const action = body.action === "unblock" ? "unblock" : "block"

    if (!targetUserId) {
      return NextResponse.json({ error: "target_user_id is required" }, { status: 400 })
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "You cannot block yourself" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Target must exist.
    const { data: target } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", targetUserId)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (action === "block") {
      const { error } = await supabase
        .from("user_blocks")
        .upsert({ blocker_id: user.id, blocked_id: targetUserId }, { onConflict: "blocker_id,blocked_id" })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Blocking cuts the social graph between the two users in both directions.
      await supabase
        .from("follows")
        .delete()
        .or(`and(follower_id.eq.${user.id},following_id.eq.${targetUserId}),and(follower_id.eq.${targetUserId},following_id.eq.${user.id})`)
      // Any pending follow requests between them are void too.
      try {
        await supabase
          .from("follow_requests")
          .delete()
          .or(`and(requester_id.eq.${user.id},target_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},target_id.eq.${user.id})`)
      } catch {
        /* follow_requests may not exist on older schemas */
      }

      return NextResponse.json({ success: true, blocked: true })
    }

    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, blocked: false })
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
