import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { createServerClient } from "@/lib/supabase"
import { smartEngagementScore, organizationRankingBoost } from "@/lib/feed-ranking"
import { applyRealCommentCounts } from "@/lib/loop-stats"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
    )

    const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? null

    let userId: string | null = null
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      if (user) {
        userId = user.id
      }
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(50, Math.max(10, Number(searchParams.get("limit") || 20)))
    const recencyWeight = Number(searchParams.get("recencyWeight") || 1.0)
    const diversityWeight = Number(searchParams.get("diversityWeight") || 0.8)

    // 1. Fetch user's historical interaction signals if logged in
    const userHashtagCounts = new Map<string, number>()
    const interactedAuthorIds = new Set<string>()

    if (userId) {
      const { data: interactions } = await supabase
        .from("loop_interactions")
        .select("loop_id, interaction_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100)

      if (interactions && interactions.length > 0) {
        const loopIds = Array.from(new Set(interactions.map((i) => i.loop_id)))
        const { data: pastLoops } = await supabase
          .from("loops")
          .select("id, author_id, hashtags")
          .in("id", loopIds)

        if (pastLoops) {
          pastLoops.forEach((loop) => {
            if (loop.author_id) interactedAuthorIds.add(loop.author_id)
            if (Array.isArray(loop.hashtags)) {
              loop.hashtags.forEach((tag: string) => {
                const norm = String(tag).toLowerCase().replace(/^#/, "")
                userHashtagCounts.set(norm, (userHashtagCounts.get(norm) || 0) + 1)
              })
            }
          })
        }
      }
    }

    // 2. Query candidate loops from Supabase database.
    // Branches (parent_loop_id != null) are included with their parent loop
    // joined, so the For You tab surfaces branched conversations too.
    const { data: candidateLoops, error } = await supabase
      .from("loops")
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, is_organization, organization_badge_url, organization_name, level, active_cosmetics, cosmetics, badge_id),
        parent_loop:loops!parent_loop_id(id, content_text, author_id, author:profiles!author_id(username, display_name, avatar_url)),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .or("visibility.eq.public,visibility.is.null")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const loops = candidateLoops || []

    // 3. Compute Database ML Recommendation Score
    const scoredLoops = loops.map((loop) => {
      const baseEngagement = smartEngagementScore(loop) * recencyWeight
      const author = Array.isArray(loop.author) ? loop.author[0] : loop.author

      // Hashtag Similarity Score (TF-IDF / Vector Affinity)
      let hashtagMatchScore = 0
      const matchedTags: string[] = []
      if (Array.isArray(loop.hashtags)) {
        loop.hashtags.forEach((tag: string) => {
          const norm = String(tag).toLowerCase().replace(/^#/, "")
          const count = userHashtagCounts.get(norm) || 0
          if (count > 0) {
            hashtagMatchScore += count * 15
            matchedTags.push(`#${norm}`)
          }
        })
      }

      // Author Affinity Score
      let authorScore = 0
      if (author?.id && interactedAuthorIds.has(author.id)) {
        authorScore += 30
      }

      // Organization Boost
      const orgBoost = organizationRankingBoost(loop)

      // Random Exploration Factor for ML Diversity
      const explorationFactor = Math.random() * 10 * diversityWeight

      // Total Combined ML Score
      const totalMlScore = Math.round(baseEngagement + hashtagMatchScore + authorScore + orgBoost + explorationFactor)

      // Normalize match percentage for display
      const matchPercentage = Math.min(99, Math.max(65, Math.round(70 + (hashtagMatchScore + authorScore) * 0.5 + (baseEngagement > 30 ? 10 : 0))))

      // Generate human-readable ML reason
      let reason = "Recommended based on trending community engagement"
      if (matchedTags.length > 0) {
        reason = `Matched via your interest in ${matchedTags.slice(0, 2).join(", ")}`
      } else if (authorScore > 0) {
        reason = `Because you interacted with @${author?.username || "creator"} before`
      } else if (orgBoost > 0) {
        reason = `Official Partner spotlight from ${author?.organization_name || "Organization"}`
      }

      return {
        ...loop,
        ml_score: totalMlScore,
        match_percentage: matchPercentage,
        recommendation_reason: reason,
      }
    })

    // Sort by ML score descending
    scoredLoops.sort((a, b) => b.ml_score - a.ml_score)

    // True comment counts from the comments table (service-role client so
    // RLS never hides rows the denormalized counter missed).
    await applyRealCommentCounts(createServerClient(), scoredLoops)

    return NextResponse.json({
      success: true,
      loops: scoredLoops.slice(0, limit),
      ml_metadata: {
        total_candidates: loops.length,
        user_top_interests: Array.from(userHashtagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag]) => `#${tag}`),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || "Internal server error" }, { status: 500 })
  }
}
