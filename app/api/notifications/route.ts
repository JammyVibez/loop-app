import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)


export async function GET(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const unreadOnly = searchParams.get("unread_only") === "true"
    const type = searchParams.get("type")

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq("is_read", false)
    }
    if (type) {
      query = query.eq("type", type)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
    }

    // Enrich notifications with actor profile data (avatar, username)
    const actorIds = new Set<string>()
    for (const n of notifications || []) {
      const d = n.data || {}
      if (d.user_id) actorIds.add(d.user_id)
      if (d.sender_id) actorIds.add(d.sender_id)
      if (d.actor_id) actorIds.add(d.actor_id)
    }

    let actorMap: Record<string, { username: string; display_name: string; avatar_url: string | null; is_verified: boolean }>
 = {}
    if (actorIds.size > 0) {
      const { data: actors } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified")
        .in("id", Array.from(actorIds))
      if (actors) {
        for (const a of actors) {
          actorMap[a.id] = a as any
        }
      }
    }

    // Attach actor info to each notification
    const enriched = (notifications || []).map((n) => {
      const d = n.data || {}
      const actorId = d.user_id || d.sender_id || d.actor_id
      const actor = actorId ? actorMap[actorId] : null
      return {
        ...n,
        actor: actor || null,
      }
    })

    // ── Grouped notifications (X/Facebook style) ──
    // Group same-type notifications targeting the same content within a 24h window.
    // High-priority types (dm, mention, reply, coloop_invite, coloop_join, duel_result) are never grouped.
    // Low-priority types (like, follow, boost) are grouped by type + content_id.
    const GROUPABLE_TYPES = new Set(["like", "follow", "boost", "branch"])
    const NEVER_GROUP_TYPES = new Set(["message", "mention", "comment", "reply", "coloop_invite", "coloop_join", "duel_result"])
    const GROUP_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

    const grouped: typeof enriched = []
    const groupMap = new Map<string, typeof enriched[0] & { actor_ids: string[]; count: number; actors: any[] }>()
    const now = Date.now()

    for (const n of enriched) {
      const d = n.data || {}
      const targetId = d.loop_id || d.post_id || d.circle_id || ""
      const groupKey = NEVER_GROUP_TYPES.has(n.type) ? n.id : `${n.type}:${targetId}`
      const withinWindow = now - new Date(n.created_at).getTime() < GROUP_WINDOW_MS

      if (NEVER_GROUP_TYPES.has(n.type) || !GROUPABLE_TYPES.has(n.type) || !withinWindow || !targetId) {
        grouped.push(n)
        continue
      }

      const existing = groupMap.get(groupKey)
      if (existing) {
        existing.count += 1
        existing.updated_at = n.created_at // bump to newest
        const actorId = d.user_id || d.sender_id || d.actor_id
        if (actorId && !existing.actor_ids.includes(actorId)) {
          existing.actor_ids.push(actorId)
          const actor = actorId ? actorMap[actorId] : null
          if (actor) existing.actors.push(actor)
        }
        // Update title/message with count
        const firstActor = existing.actors[0]?.display_name || existing.actors[0]?.username || "Someone"
        if (existing.count === 2) {
          const secondActor = existing.actors[1]?.display_name || existing.actors[1]?.username || "Someone"
          existing.title = `${firstActor} and ${secondActor} ${n.type === "like" ? "liked" : n.type === "follow" ? "followed" : n.type === "boost" ? "boosted" : "branched"} your post`
        } else if (existing.count > 2) {
          existing.title = `${firstActor} and ${existing.count - 1} others ${n.type === "like" ? "liked" : n.type === "follow" ? "followed" : n.type === "boost" ? "boosted" : "branched"} your post`
        }
        // Keep top 3 actor avatars for display
        existing.actor_ids = existing.actor_ids.slice(0, 10)
        existing.actors = existing.actors.slice(0, 10)
      } else {
        const actorId = d.user_id || d.sender_id || d.actor_id
        const actor = actorId ? actorMap[actorId] : null
        groupMap.set(groupKey, {
          ...n,
          actor_ids: actorId ? [actorId] : [],
          count: 1,
          actors: actor ? [actor] : [],
        })
      }
    }

    // Add grouped items back in order (newest first)
    for (const g of groupMap.values()) {
      grouped.push(g)
    }

    // Sort by updated_at descending
    grouped.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())

    return NextResponse.json({
      success: true,
      notifications: grouped,
      hasMore: notifications?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { notification_ids, mark_all_read } = await request.json()

    if (mark_all_read) {
      // Mark all notifications as read
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false)

      if (error) {
        console.error("Database error:", error)
        return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      })
    }

    if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .in("id", notification_ids)

      if (error) {
        console.error("Database error:", error)
        return NextResponse.json({ error: "Failed to mark notifications as read" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Notifications marked as read",
      })
    }

    return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 })
  } catch (error) {
    console.error("Error updating notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { user_id, type, title, message, data } = await request.json()

    if (!user_id || !type || !title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Create notification
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        user_id,
        type,
        title,
        message,
        data: data || null,
        is_read: false,
      })
      .select()
      .single()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to create notification" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      notification,
    })
  } catch (error) {
    console.error("Error creating notification:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const notificationId = searchParams.get("id")
    const clearAll = searchParams.get("clear_all") === "true"

    if (clearAll) {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id)

      if (error) {
        console.error("Database delete error:", error)
        return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "All notifications cleared",
      })
    }

    if (notificationId) {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id)
        .eq("id", notificationId)

      if (error) {
        console.error("Database delete error:", error)
        return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Notification deleted",
      })
    }

    return NextResponse.json({ error: "Notification ID or clear_all parameter required" }, { status: 400 })
  } catch (error) {
    console.error("Error deleting notification:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
