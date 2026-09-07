import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoop } from "@/lib/normalize-loop"
import { getUserFromRequest } from "@/lib/server-auth"
import { applyRealCommentCounts, applyRealBranchCounts } from "@/lib/loop-stats"
import { enrichLoopsWithPollsAndDuels } from "@/lib/enrich-loops"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Saved loops (posts)
    const { data: saves, error } = await supabase
      .from("loop_interactions")
      .select(`
        id,
        created_at,
        loop:loops!loop_id(
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        )
      `)
      .eq("user_id", user.id)
      .eq("interaction_type", "save")
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // True comment & branch counts from the source tables before normalizing.
    const loopRows = (saves || [])
      .map((save: any) => (Array.isArray(save.loop) ? save.loop[0] : save.loop))
      .filter(Boolean)
    await enrichLoopsWithPollsAndDuels(supabase, loopRows)
    await applyRealCommentCounts(supabase, loopRows)
    await applyRealBranchCounts(supabase, loopRows)

    const bookmarks = (saves || [])
      .map((save: any) => {
        const loop = Array.isArray(save.loop) ? save.loop[0] : save.loop
        if (!loop) return null
        return {
          id: save.id,
          type: "loop" as const,
          saved_at: save.created_at,
          category: loop.category || "General",
          loop: normalizeLoop(loop, ["save"]),
          branch_count: (Array.isArray(loop.loop_stats) ? loop.loop_stats[0]?.branches_count : loop.loop_stats?.branches_count) || 0,
        }
      })
      .filter(Boolean)

    // Saved reels — same interaction type ("save") lives in reel_interactions.
    const { data: reelSaves, error: reelError } = await supabase
      .from("reel_interactions")
      .select(`
        id,
        created_at,
        reel:reels!reel_id(
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, badge_id)
        )
      `)
      .eq("user_id", user.id)
      .eq("interaction_type", "save")
      .order("created_at", { ascending: false })

    if (reelError && !reelError.message.includes("reel_interactions")) {
      console.warn("Saved reels fetch error:", reelError.message)
    }

    const reelBookmarks = (reelSaves || []).map((save: any) => {
      const reel = Array.isArray(save.reel) ? save.reel[0] : save.reel
      if (!reel) return null
      // Map the reel onto the loop shape so the shared LoopCard renders it
      // (video thumbnail + player) without a dedicated reel card here.
      const loopLike = {
        id: reel.id,
        author_id: reel.author_id,
        content: reel.content || reel.title || "",
        content_title: reel.title || reel.content || "Reel",
        content_text: reel.content || reel.title || "",
        media_type: reel.content_type || "video",
        media_url: reel.content_url || reel.media_url,
        thumbnail_url: reel.thumbnail_url || null,
        hashtags: reel.hashtags || [],
        created_at: reel.created_at,
        visibility: reel.visibility || "public",
        parent_loop_id: null,
        author: reel.author,
        loop_stats: {
          likes_count: reel.like_count || 0,
          comments_count: reel.comment_count || 0,
          views_count: reel.view_count || 0,
          shares_count: reel.share_count || 0,
        },
        user_interactions: { is_saved: true, is_liked: false },
      }
      return {
        id: save.id,
        type: "reel" as const,
        saved_at: save.created_at,
        category: "Reels",
        loop: normalizeLoop(loopLike, ["save"]),
        branch_count: 0,
      }
    }).filter(Boolean)

    // Merge: newest saved first
    const merged = [...bookmarks, ...reelBookmarks].sort(
      (a: any, b: any) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime(),
    )

    return NextResponse.json({ success: true, bookmarks: merged })
  } catch (error: any) {
    console.error("Bookmarks error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
