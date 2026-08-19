import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const supabase = createServerClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return { user, error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { user, error: null, supabase }
}

/**
 * GET – List all Co-Loop sessions with status, filtering by status.
 * Query params: status (active|published|ended), limit, offset
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin.error) return admin.error

    const supabase = admin.supabase!
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || ""
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("co_loop_sessions")
      .select("*, owner:profiles!owner_id(id, username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status && ["active", "published", "ended"].includes(status)) {
      query = query.eq("status", status)
    }

    const { data: sessions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get total counts
    const [activeRes, publishedRes, endedRes] = await Promise.all([
      supabase.from("co_loop_sessions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("co_loop_sessions").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("co_loop_sessions").select("id", { count: "exact", head: true }).eq("status", "ended"),
    ])

    // Count open invite sessions
    const { count: openInviteCount } = await supabase
      .from("co_loop_sessions")
      .select("id", { count: "exact", head: true })
      .eq("is_open_invite", true)

    return NextResponse.json({
      success: true,
      sessions,
      counts: {
        active: activeRes.count || 0,
        published: publishedRes.count || 0,
        ended: endedRes.count || 0,
        open_invites: openInviteCount || 0,
      },
      pagination: { limit, offset },
    })
  } catch (error: any) {
    console.error("Admin co-loop sessions list error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE – Delete inactive (ended/published) Co-Loop sessions and their related data.
 * Body: { session_ids?: string[], delete_all_ended?: boolean }
 */
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (admin.error) return admin.error

    const supabase = admin.supabase!
    const body = await request.json()
    const { session_ids, delete_all_ended = false } = body

    let deletedCount = 0

    if (delete_all_ended) {
      // Delete all ended sessions
      const { data: endedSessions, error: fetchError } = await supabase
        .from("co_loop_sessions")
        .select("session_id, feed_post_id")
        .eq("status", "ended")

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      const sessions = endedSessions || []
      if (sessions.length === 0) {
        return NextResponse.json({ success: true, message: "No ended sessions to delete", deleted: 0 })
      }

      // Delete participants
      for (const s of sessions) {
        await supabase.from("open_co_loop_participants").delete().eq("session_id", s.session_id)
      }

      // Delete sessions
      const { error: deleteError } = await supabase
        .from("co_loop_sessions")
        .delete()
        .eq("status", "ended")

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      deletedCount = sessions.length
    } else if (Array.isArray(session_ids) && session_ids.length > 0) {
      // Delete specific sessions
      for (const sid of session_ids) {
        // Get session details first
        const { data: session } = await supabase
          .from("co_loop_sessions")
          .select("session_id, feed_post_id, status, co_authors")
          .eq("session_id", sid)
          .maybeSingle()

        if (!session) continue

        // Allow deleting ended/published sessions, or active sessions with no co-authors
        const coAuthorsCount = Array.isArray(session.co_authors) ? session.co_authors.length : 0
        if (session.status === "active" && coAuthorsCount > 0) continue

        // Delete participants
        await supabase.from("open_co_loop_participants").delete().eq("session_id", sid)

        // Delete the session
        await supabase.from("co_loop_sessions").delete().eq("session_id", sid)

        // Optionally soft-delete the feed post
        if (session.feed_post_id) {
          await supabase
            .from("loops")
            .update({ visibility: "deleted" })
            .eq("id", session.feed_post_id)
        }

        deletedCount++
      }
    } else {
      return NextResponse.json(
        { error: "Provide session_ids array or set delete_all_ended to true" },
        { status: 400 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} co-loop session(s)`,
      deleted: deletedCount,
    })
  } catch (error: any) {
    console.error("Admin co-loop sessions delete error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
