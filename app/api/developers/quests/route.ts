import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest, requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const DIFFICULTIES = ["beginner", "intermediate", "expert"]

/**
 * GET /api/developers/quests
 * Active quests (with approved-completion counts + the caller's own
 * submission state when signed in).
 *
 * POST /api/developers/quests (admin)
 * Create a new quest / bounty.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    const supabase = createServerClient()

    const { data: quests, error } = await supabase
      .from("dev_quests")
      .select("*, created_by:profiles!dev_quests_created_by_fkey(id, username, display_name)")
      .eq("is_active", true)
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const list = quests || []

    // Approved completion counts per quest (small data set — aggregate in JS).
    let counts: Record<string, number> = {}
    try {
      const { data: approved } = await supabase
        .from("dev_quest_submissions")
        .select("quest_id")
        .eq("status", "approved")
        .in("quest_id", list.map((q: any) => q.id))
      counts = (approved || []).reduce((acc: Record<string, number>, s: any) => {
        acc[s.quest_id] = (acc[s.quest_id] || 0) + 1
        return acc
      }, {})
    } catch (err) {
      console.error("quests: completion counts failed:", err)
    }

    // Caller's own submissions.
    let mySubmissions: Record<string, any> = {}
    if (user) {
      try {
        const { data: mine } = await supabase
          .from("dev_quest_submissions")
          .select("id, quest_id, status, reward_coins_awarded, created_at")
          .eq("user_id", user.id)
        mySubmissions = (mine || []).reduce((acc: Record<string, any>, s: any) => {
          acc[s.quest_id] = s
          return acc
        }, {})
      } catch (err) {
        console.error("quests: my submissions failed:", err)
      }
    }

    return NextResponse.json({
      success: true,
      quests: list.map((q: any) => ({
        ...q,
        completions: counts[q.id] || 0,
        my_submission: mySubmissions[q.id] || null,
      })),
    })
  } catch (error: any) {
    console.error("Dev quests GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const title = String(body.title || "").trim()
    const description = String(body.description || "").trim()
    const difficulty = DIFFICULTIES.includes(body.difficulty) ? body.difficulty : "beginner"
    const rewardCoins = Math.max(0, Number(body.reward_coins) || 0)
    const tags = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean).slice(0, 10) : []
    const endsAt = body.ends_at ? String(body.ends_at) : null
    const isActive = body.is_active !== false

    if (!title || !description) {
      return NextResponse.json({ error: "title and description are required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: quest, error } = await supabase
      .from("dev_quests")
      .insert({
        title: title.slice(0, 160),
        description,
        difficulty,
        reward_coins: rewardCoins,
        tags,
        ends_at: endsAt,
        is_active: isActive,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, quest }, { status: 201 })
  } catch (error: any) {
    console.error("Dev quests POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
