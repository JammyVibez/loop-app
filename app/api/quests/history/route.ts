import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * GET /api/quests/history — the user's quest history.
 * Joins quest_progress (latest rows) with quests and the claim ledger so the
 * user can see status + exact rewards earned for each entry.
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

  try {
    const supabase = createServerClient()

    const { data: progressRows } = await supabase
      .from("quest_progress")
      .select("quest_id, progress_count, completed_at, claimed_at, window_key, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(200)

    const questIds = [...new Set((progressRows || []).map((r: any) => r.quest_id))]
    let questsById: Record<string, any> = {}
    let claimsByQuest: Record<string, any[]> = {}

    if (questIds.length > 0) {
      const [{ data: questRows }, { data: claimRows }] = await Promise.all([
        supabase
          .from("quests")
          .select("id, title, description, icon, accent, banner_url, quest_type, quest_kind, cadence, category, reward_coins, reward_xp, reward_label, reward_item_id, ends_at, status, mission_config")
          .in("id", questIds),
        supabase
          .from("quest_claims")
          .select("quest_id, coins_awarded, xp_awarded, item_id, created_at")
          .eq("user_id", user.id)
          .in("quest_id", questIds),
      ])
      for (const q of questRows || []) questsById[q.id] = q
      for (const c of claimRows || []) (claimsByQuest[c.quest_id] ??= []).push(c)
    }

    // Reward item names.
    const itemIds = Object.values(questsById)
      .map((q: any) => q.reward_item_id)
      .filter((id: any) => id != null)
    const itemMap: Record<number, string> = {}
    if (itemIds.length > 0) {
      const { data: items } = await supabase.from("shop_items").select("id, name").in("id", itemIds as number[])
      for (const it of items || []) itemMap[it.id] = it.name
    }

    const now = new Date()
    const history = (progressRows || [])
      .filter((r: any) => questsById[r.quest_id])
      .map((r: any) => {
        const q = questsById[r.quest_id]
        const expired = q.ends_at && new Date(q.ends_at) < now && !r.claimed_at
        const claims = claimsByQuest[r.quest_id] || []
        const rewards = claims.reduce(
          (acc: { coins: number; xp: number }, c: any) => ({
            coins: acc.coins + Number(c.coins_awarded || 0),
            xp: acc.xp + Number(c.xp_awarded || 0),
          }),
          { coins: 0, xp: 0 },
        )
        let status: "claimed" | "completed" | "in_progress" | "expired" = "in_progress"
        if (r.claimed_at) status = "claimed"
        else if (expired) status = "expired"
        else if (r.completed_at) status = "completed"
        return {
          quest_id: r.quest_id,
          title: q.title,
          description: q.description,
          icon: q.icon,
          accent: q.accent,
          banner_url: q.banner_url,
          quest_type: q.quest_type,
          quest_kind: q.quest_kind,
          cadence: q.cadence,
          category: q.category,
          reward_label: q.reward_label || (q.reward_coins > 0 ? `${q.reward_coins} coins` : null),
          reward_item_name: q.reward_item_id ? itemMap[q.reward_item_id] || null : null,
          progress: {
            count: r.progress_count,
            completed: Boolean(r.completed_at),
            claimed: Boolean(r.claimed_at),
          },
          rewards_earned: rewards,
          coins_claimed: rewards.coins,
          status,
          completed_at: r.completed_at,
          claimed_at: r.claimed_at,
          updated_at: r.updated_at,
        }
      })

    return NextResponse.json({ success: true, history })
  } catch (error: any) {
    console.error("GET /api/quests/history error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
