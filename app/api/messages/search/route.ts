import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "30"), 50)

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], conversations: [] })
    }

    const supabase = createServerClient()

    // Find conversations the user participates in
    const { data: participantRows } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id)
      .is("left_at", null)

    const convoIds = (participantRows || []).map((r) => r.conversation_id)
    if (convoIds.length === 0) {
      return NextResponse.json({ results: [], conversations: [] })
    }

    // Search messages across all conversations
    const { data: messages, error } = await supabase
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        conversation_id,
        author_id,
        sender:profiles!messages_author_id_fkey(id, username, display_name, avatar_url)
      `)
      .in("conversation_id", convoIds)
      .ilike("content", `%${query}%`)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      // Fallback without join
      const fallback = await supabase
        .from("messages")
        .select("id, content, created_at, conversation_id, author_id")
        .in("conversation_id", convoIds)
        .ilike("content", `%${query}%`)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      }

      return NextResponse.json({ results: fallback.data || [], conversations: [] })
    }

    // Also find conversations whose name matches
    const { data: convoMatches } = await supabase
      .from("conversations")
      .select("id, name")
      .in("id", convoIds)
      .ilike("name", `%${query}%`)
      .limit(5)

    return NextResponse.json({
      results: messages || [],
      conversations: convoMatches || [],
    })
  } catch (error: any) {
    console.error("Message search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
