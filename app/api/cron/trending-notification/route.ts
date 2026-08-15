import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { notifyUsers } from "@/lib/notifications"

export const dynamic = "force-dynamic"
export const maxDuration = 55

// Vercel cron: every 6 hours (protected by CRON_SECRET).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")?.replace("Bearer ", "") || ""
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServerClient()

    // Pick a random high-engagement loop from the last 7 days.
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: loops } = await supabase
      .from("loops")
      .select(
        `id, content_text, content_title,
         author:profiles!author_id(id, username, display_name),
         loop_stats(likes_count, comments_count, branches_count, views_count)`
      )
      .eq("visibility", "public")
      .gt("created_at", weekAgo)
      .limit(40)

    const candidates = (loops || []).filter((loop: any) => {
      const stats = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats
      return Number(stats?.likes_count || 0) + Number(stats?.comments_count || 0) >= 5
    })

    if (!candidates.length) {
      return NextResponse.json({ success: true, skipped: true, reason: "no trending loops" })
    }

    const trending = candidates[Math.floor(Math.random() * candidates.length)]
    const authorName = Array.isArray(trending.author) ? trending.author[0] : trending.author
    const title =
      trending.content_title || trending.content_text?.slice(0, 60) || "A trending loop"
    const authorLabel = authorName?.display_name || authorName?.username || "someone"

    // Notify a random sample of active users.
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(300)
    const pool = (profiles || []).map((p: any) => p.id)
    const sample = pool.sort(() => Math.random() - 0.5).slice(0, 60)

    if (!sample.length) {
      return NextResponse.json({ success: true, skipped: true, reason: "no users" })
    }

    await notifyUsers(supabase, sample, {
      type: "trending",
      title: `🔥 Trending: ${title.slice(0, 60)}`,
      message: `by @${authorLabel} — join the conversation on loopapp.me`,
      actionUrl: `/loop/${trending.id}`,
      data: { loop_id: trending.id, broadcast: true },
      pushCategory: "social",
    })

    return NextResponse.json({
      success: true,
      loop_id: trending.id,
      notified: sample.length,
    })
  } catch (error: any) {
    console.error("Trending notification cron error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
