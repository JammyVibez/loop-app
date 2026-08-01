import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sourceLabel } from "@/lib/mentions"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUser(token: string | null) {
  if (!token) return null
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

/**
 * Tagged inbox — why/where you were @mentioned.
 * GET /api/mentions?limit=20&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(50, Number.parseInt(searchParams.get("limit") || "20") || 20)
    const offset = Number.parseInt(searchParams.get("offset") || "0") || 0

    const { data: rows, error } = await supabase
      .from("user_mentions")
      .select(
        `
        id, source_type, source_id, loop_id, comment_id, circle_id, post_id, reel_id,
        snippet, href, created_at, actor_id,
        actor:profiles!actor_id(id, username, display_name, avatar_url, is_verified)
      `,
      )
      .eq("mentioned_user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      // Fallback without join if FK name differs
      const { data: plain, error: plainError } = await supabase
        .from("user_mentions")
        .select("*")
        .eq("mentioned_user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)

      if (plainError) {
        return NextResponse.json({ error: plainError.message || error.message }, { status: 500 })
      }

      const actorIds = [...new Set((plain || []).map((r) => r.actor_id).filter(Boolean))]
      const { data: actors } = actorIds.length
        ? await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, is_verified")
            .in("id", actorIds)
        : { data: [] as any[] }
      const byId = new Map((actors || []).map((a) => [a.id, a]))

      const mentions = (plain || []).map((row) => ({
        ...row,
        actor: byId.get(row.actor_id) || null,
        why: `Tagged you in ${sourceLabel(row.source_type)}`,
      }))

      return NextResponse.json({ success: true, mentions, hasMore: mentions.length === limit })
    }

    const mentions = (rows || []).map((row: any) => ({
      ...row,
      actor: Array.isArray(row.actor) ? row.actor[0] : row.actor,
      why: `Tagged you in ${sourceLabel(row.source_type)}`,
    }))

    return NextResponse.json({
      success: true,
      mentions,
      hasMore: mentions.length === limit,
    })
  } catch (error: any) {
    console.error("mentions feed error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
