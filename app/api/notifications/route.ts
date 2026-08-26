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

    return NextResponse.json({
      success: true,
      notifications: enriched,
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
