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

    // Housekeeping: delete expired Moments (they self-destruct after 24-48h)
    // and prune lapsed Pro members from the Pro-only circle so membership
    // always matches current subscription state even if a trigger edge case
    // slipped through.
    try {
      const { data: deleted } = await supabase
        .from("moments")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .select("id")
      const deletedIds = deleted || []
      if (deletedIds.length > 0) {
        console.log(`Moments cleanup: removed ${deletedIds.length} expired moments`)
      }
    } catch (momentErr) {
      console.warn("Moments cleanup skipped:", momentErr)
    }

    try {
      const { data: proCircle } = await supabase
        .from("circles")
        .select("id")
        .eq("is_premium_only", true)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
      if (proCircle) {
        // Remove members whose Pro subscription has lapsed.
        const { data: lapsed } = await supabase
          .from("profiles")
          .select("id, avatar_url, banner_url")
          .lt("premium_expires_at", new Date().toISOString())
          .eq("is_premium", true)
          .limit(500)
        if ((lapsed || []).length > 0) {
          await supabase
            .from("circle_members")
            .delete()
            .eq("circle_id", proCircle.id)
            .in(
              "user_id",
              (lapsed || []).map((p: any) => p.id),
            )
          // GIF avatars/covers are Pro-only — revert them when Pro lapses.
          const gifLapsed = (lapsed || []).filter(
            (p: any) => /\.gif(\?|#|$)/i.test(String(p.avatar_url || "")) || /\.gif(\?|#|$)/i.test(String(p.banner_url || "")),
          )
          if (gifLapsed.length > 0) {
            const ids = gifLapsed.map((p: any) => p.id)
            const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
            if (gifLapsed.some((p: any) => /\.gif(\?|#|$)/i.test(String(p.avatar_url || "")))) patch.avatar_url = null
            if (gifLapsed.some((p: any) => /\.gif(\?|#|$)/i.test(String(p.banner_url || "")))) patch.banner_url = null
            await supabase.from("profiles").update(patch).in("id", ids)
          }
        }
        // Re-add any active Pros missing from the circle (backstop for the trigger).
        const { data: activePros } = await supabase
          .from("profiles")
          .select("id")
          .eq("is_premium", true)
          .or("premium_expires_at.is.null,premium_expires_at.gt." + new Date().toISOString())
          .limit(500)
        if ((activePros || []).length > 0) {
          const { data: existingMembers } = await supabase
            .from("circle_members")
            .select("user_id")
            .eq("circle_id", proCircle.id)
          const existing = new Set((existingMembers || []).map((m: any) => m.user_id))
          const inserts = (activePros || [])
            .filter((p: any) => !existing.has(p.id))
            .map((p: any) => ({
              circle_id: proCircle.id,
              user_id: p.id,
              role: "member",
              status: "active",
              joined_at: new Date().toISOString(),
            }))
          if (inserts.length > 0) {
            await supabase.from("circle_members").insert(inserts)
          }
        }
      }
    } catch (proErr) {
      console.warn("Pro circle sync skipped:", proErr)
    }

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
