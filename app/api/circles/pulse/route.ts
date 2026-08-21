import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

function milestoneFor(count: number) {
  const reached = MILESTONES.filter((m) => count >= m)
  if (!reached.length) return null
  return { milestone: reached[reached.length - 1], next: MILESTONES.find((m) => m > count) || null }
}

/**
 * "Things are happening here" — live pulse for the circles the user belongs
 * to: new posts / comments in the last 24h, upcoming events, member counts
 * and milestone detection. Feeds the Circle Pulse strip on /circles.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    if (!token) return NextResponse.json({ success: true, circles: [] })

    const supabase = createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ success: true, circles: [] })

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: memberships } = await supabase
      .from("circle_members")
      .select("circle_id, role, status")
      .eq("user_id", user.id)
      .neq("status", "banned")

    const circleIds = (memberships || []).filter((m) => m.status === "active").map((m) => m.circle_id)
    if (!circleIds.length) return NextResponse.json({ success: true, circles: [] })

    const { data: circles } = await supabase
      .from("circles")
      .select("id, name, description, avatar_url, video_avatar_url, banner_url, is_premium_only, is_private, category, created_at")
      .in("id", circleIds)
      .limit(20)

    if (!circles?.length) return NextResponse.json({ success: true, circles: [] })

    const [membersRes, postsRes, commentsRes, eventsRes] = await Promise.all([
      supabase
        .from("circle_members")
        .select("circle_id")
        .in("circle_id", circleIds)
        .eq("status", "active"),
      supabase
        .from("circle_posts")
        .select("circle_id, id")
        .in("circle_id", circleIds)
        .gte("created_at", since)
        .limit(200),
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

    const memberCounts = new Map<string, number>()
    for (const row of membersRes.data || []) {
      memberCounts.set(row.circle_id, (memberCounts.get(row.circle_id) || 0) + 1)
    }

    const postsByCircle = new Map<string, number>()
    for (const row of postsRes.data || []) {
      postsByCircle.set(row.circle_id, (postsByCircle.get(row.circle_id) || 0) + 1)
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
        const memberCount = memberCounts.get(circle.id) || 0
        const milestone = milestoneFor(memberCount)
        return {
          ...circle,
          member_count: memberCount,
          new_posts: postsByCircle.get(circle.id) || 0,
          new_comments: commentsByCircle.get(circle.id) || 0,
          upcoming_events: eventsByCircle.get(circle.id) || [],
          milestone: milestone
            ? {
                reached: milestone.milestone,
                next: milestone.next,
                progress: milestone.next ? Math.min(100, Math.round((memberCount / milestone.next) * 100)) : 100,
              }
            : null,
          activity: (postsByCircle.get(circle.id) || 0) + (commentsByCircle.get(circle.id) || 0),
        }
      })
      .sort((a, b) => b.activity - a.activity)

    return NextResponse.json({ success: true, circles: enriched })
  } catch (error) {
    console.error("circle pulse error:", error)
    return NextResponse.json({ success: true, circles: [] })
  }
}
