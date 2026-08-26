import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

/**
 * "Your circles are active" — participation surface for the home feed.
 * Returns the circles the viewer belongs to that have had real activity in
 * the last 24h (new posts, new comments, upcoming events), so the feed can
 * invite the user back into their communities instead of only showing
 * generic content.
 */
export async function GET(request: NextRequest) {
  try {
    if (!token) return NextResponse.json({ success: true, circles: [], total_activity: 0 })

    const supabase = createServerClient()
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: true, circles: [], total_activity: 0 })

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: memberships } = await supabase
      .from("circle_members")
      .select("circle_id, role, status")
      .eq("user_id", user.id)
      .neq("status", "banned")

    const circleIds = (memberships || []).filter((m) => m.status === "active").map((m) => m.circle_id)
    if (!circleIds.length) return NextResponse.json({ success: true, circles: [], total_activity: 0 })

    const { data: circles } = await supabase
      .from("circles")
      .select("id, name, description, avatar_url, video_avatar_url, banner_url, is_premium_only, is_private, category")
      .in("id", circleIds)
      .limit(12)

    if (!circles?.length) return NextResponse.json({ success: true, circles: [], total_activity: 0 })

    // Per-circle activity counts in the last 24h (batch, one query per surface)
    const [postsRes, commentsRes, eventsRes] = await Promise.all([
      supabase
        .from("circle_posts")
        .select("circle_id, id, content, created_at, author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url)")
        .in("circle_id", circleIds)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("circle_post_comments")
        .select("id, created_at, post_id, post:circle_posts!post_id(circle_id)")
        .gte("created_at", since)
        .limit(200),
      supabase
        .from("circle_events")
        .select("circle_id, id, title, starts_at")
        .in("circle_id", circleIds)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(40),
    ])

    const postsByCircle = new Map<string, any[]>()
    for (const post of postsRes.data || []) {
      const cid = post.circle_id
      if (!postsByCircle.has(cid)) postsByCircle.set(cid, [])
      postsByCircle.get(cid)!.push(post)
    }

    const commentsByCircle = new Map<string, number>()
    const allowed = new Set(circleIds)
    for (const row of (commentsRes.data || []) as any[]) {
      const post = Array.isArray(row?.post) ? row.post[0] : row?.post
      const cid = post?.circle_id
      if (cid && allowed.has(cid)) commentsByCircle.set(cid, (commentsByCircle.get(cid) || 0) + 1)
    }

    const eventsByCircle = new Map<string, any[]>()
    for (const event of eventsRes.data || []) {
      if (!eventsByCircle.has(event.circle_id)) eventsByCircle.set(event.circle_id, [])
      eventsByCircle.get(event.circle_id)!.push(event)
    }

    const enriched = circles
      .map((circle) => {
        const posts = postsByCircle.get(circle.id) || []
        const commentCount = commentsByCircle.get(circle.id) || 0
        const events = eventsByCircle.get(circle.id) || []
        return {
          ...circle,
          new_posts: posts.length,
          new_comments: commentCount,
          upcoming_events: events.length,
          recent_posts: posts.slice(0, 2).map((p) => ({
            id: p.id,
            content: String(p.content || p.content_text || "").slice(0, 140),
            created_at: p.created_at,
            author: Array.isArray(p.author) ? p.author[0] : p.author,
          })),
          activity: posts.length + commentCount,
        }
      })
      .filter((c) => c.activity > 0)
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 3)

    const totalActivity = enriched.reduce((sum, c) => sum + c.activity, 0)
    return NextResponse.json({ success: true, circles: enriched, total_activity: totalActivity })
  } catch (error) {
    console.error("circle-activity error:", error)
    return NextResponse.json({ success: true, circles: [], total_activity: 0 })
  }
}
