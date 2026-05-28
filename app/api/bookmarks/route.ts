import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoop } from "@/lib/normalize-loop"

async function getUser(request: NextRequest) {
  const supabase = createServerClient()
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: saves, error } = await supabase
      .from("loop_interactions")
      .select(`
        id,
        created_at,
        loop:loops!loop_id(
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        )
      `)
      .eq("user_id", user.id)
      .eq("interaction_type", "save")
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const bookmarks = (saves || [])
      .map((save: any) => {
        const loop = Array.isArray(save.loop) ? save.loop[0] : save.loop
        if (!loop) return null
        return {
          id: save.id,
          type: "loop",
          saved_at: save.created_at,
          category: loop.category || "General",
          loop: normalizeLoop(loop, ["save"]),
          branch_count: (Array.isArray(loop.loop_stats) ? loop.loop_stats[0]?.branches_count : loop.loop_stats?.branches_count) || 0,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ success: true, bookmarks })
  } catch (error: any) {
    console.error("Bookmarks error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
