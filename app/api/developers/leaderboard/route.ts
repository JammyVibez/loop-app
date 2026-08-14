import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * GET /api/developers/leaderboard
 * Ranks developers by impact across the Developer Hub:
 *   score = total stars received on projects + likes on snippets +
 *           projects published + forks received
 * (stars weigh more than activity so quality wins over volume).
 */
export async function GET() {
  try {
    const supabase = createServerClient()

    const [projectsRes, snippetsRes, profilesRes, portfoliosRes] = await Promise.all([
      supabase
        .from("developer_projects")
        .select("author_id, stars, forks")
        .eq("is_public", true)
        .limit(300),
      supabase.from("code_snippets").select("author_id, likes").eq("is_public", true).limit(300),
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified, verification_level")
        .limit(300),
      supabase
        .from("developer_portfolios")
        .select("user_id, is_available_for_hire, hourly_rate")
        .limit(300),
    ])

    const projects = projectsRes.data || []
    const snippets = snippetsRes.data || []
    const profiles = (profilesRes.data || []).reduce((acc: Record<string, any>, p: any) => {
      acc[p.id] = p
      return acc
    }, {})
    const portfolios = (portfoliosRes.data || []).reduce((acc: Record<string, any>, p: any) => {
      acc[p.user_id] = p
      return acc
    }, {})

    const tally: Record<
      string,
      { stars: number; forks: number; projects: number; snippet_likes: number; snippets: number }
    > = {}

    for (const p of projects) {
      if (!p.author_id) continue
      const t = (tally[p.author_id] ||= { stars: 0, forks: 0, projects: 0, snippet_likes: 0, snippets: 0 })
      t.stars += Number(p.stars || 0)
      t.forks += Number(p.forks || 0)
      t.projects += 1
    }
    for (const s of snippets) {
      if (!s.author_id) continue
      const t = (tally[s.author_id] ||= { stars: 0, forks: 0, projects: 0, snippet_likes: 0, snippets: 0 })
      t.snippet_likes += Number(s.likes || 0)
      t.snippets += 1
    }

    const rows = Object.entries(tally)
      .map(([id, t]) => {
        const profile = profiles[id] || {}
        const portfolio = portfolios[id]
        return {
          id,
          username: profile.username || "user",
          display_name: profile.display_name || profile.username || "Developer",
          avatar_url: profile.avatar_url || null,
          is_verified: Boolean(profile.is_verified),
          verification_level: profile.verification_level || null,
          is_available_for_hire: Boolean(portfolio?.is_available_for_hire),
          hourly_rate: portfolio?.hourly_rate ? Number(portfolio.hourly_rate) : null,
          stats: t,
          score: t.stars * 3 + t.snippet_likes * 2 + t.forks + t.projects + t.snippets,
        }
      })
      .sort((a, b) => b.score - a.score || b.stats.stars - a.stats.stars)
      .slice(0, 20)

    return NextResponse.json({ success: true, leaderboard: rows })
  } catch (error: any) {
    console.error("Developer leaderboard error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
