import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
    if (!token) return NextResponse.json({ success: true, count: 0 })

    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ success: true, count: 0 })
    }

    // Get conversation IDs where user is active participant
    const { data: memberships } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id)
      .is("left_at", null)

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    const conversationIds = memberships.map((m) => m.conversation_id)

    // Count unread messages (sender != user.id and is_read = false, or created_at > last_read_at)
    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_id", user.id)
      .neq("author_id", user.id)
      .eq("is_read", false)

    if (error) {
      // Fallback: query without is_read filter if column doesn't exist yet
      const { count: fallbackCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .neq("sender_id", user.id)
      
      return NextResponse.json({ success: true, count: fallbackCount || 0 })
    }

    return NextResponse.json({ success: true, count: count || 0 })
  } catch (error) {
    console.error("Error getting unread count:", error)
    return NextResponse.json({ success: true, count: 0 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { conversation_id } = await request.json()

    if (conversation_id) {
      // Mark messages in this conversation as read
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation_id)
        .neq("sender_id", user.id)
        .neq("author_id", user.id)

      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversation_id)
        .eq("user_id", user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed marking read" }, { status: 500 })
  }
}
