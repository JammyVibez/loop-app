import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const QUEST_TYPES = ["ad", "survey", "minigame", "native"]
const CADENCES = ["daily", "weekly", "seasonal"]
const REWARD_TYPES = ["coins", "xp", "item", "coins_xp"]
const VISIBILITIES = ["all", "pro", "organization", "new_users"]
const NATIVE_ACTIONS = ["create_loop", "create_comment", "join_circle", "win_duel", "send_gift", "daily_checkin"]
const MINIGAME_KINDS = ["trivia", "reaction"]
const ACCENTS = ["violet", "amber", "emerald", "cyan", "rose", "sky"]

/**
 * GET /api/admin/quests — full quest catalog with completion analytics.
 */
export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const supabase = createServerClient()

    const [{ data: quests, error }, { data: claims }, { data: caps }] = await Promise.all([
      supabase.from("quests").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("quest_claims").select("quest_id, coins_awarded, xp_awarded, item_id, created_at"),
      supabase
        .from("admin_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["quest_daily_coin_cap", "quest_daily_xp_cap", "ad_network_secret", "survey_network_secret"]),
    ])

    if (error) {
      console.warn("Error fetching quests (returning empty catalog):", error.message)
      return NextResponse.json({ quests: [], caps: {} })
    }

    // Per-quest analytics.
    const stats: Record<string, { completions: number; coins_paid: number; xp_paid: number; last_30d: number }> = {}
    const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString()
    for (const c of claims || []) {
      const s = (stats[c.quest_id] ??= { completions: 0, coins_paid: 0, xp_paid: 0, last_30d: 0 })
      s.completions++
      s.coins_paid += Number(c.coins_awarded || 0)
      s.xp_paid += Number(c.xp_awarded || 0)
      if (c.created_at && c.created_at >= cutoff30) s.last_30d++
    }

    const capMap: Record<string, any> = {}
    for (const row of caps || []) {
      const v = typeof row.setting_value === "string" ? (() => { try { return JSON.parse(row.setting_value) } catch { return row.setting_value } })() : row.setting_value
      capMap[row.setting_key] = (v as any)?.value ?? (v as any) ?? null
    }

    return NextResponse.json({ success: true, quests: quests || [], stats, caps: capMap })
  } catch (error: any) {
    console.error("Error in quest GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/quests — create a quest.
 */
export async function POST(request: NextRequest) {
  const { response, user } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const supabase = createServerClient()

    const title = String(body.title || "").trim()
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
    if (!QUEST_TYPES.includes(body.quest_type)) return NextResponse.json({ error: "Invalid quest type" }, { status: 400 })
    if (!CADENCES.includes(body.cadence)) return NextResponse.json({ error: "Invalid cadence" }, { status: 400 })

    const requirementCount = Math.max(1, Math.floor(Number(body.requirement_count || 1)))
    const rewardType = REWARD_TYPES.includes(body.reward_type) ? body.reward_type : "coins"
    if (rewardType === "coins" && Number(body.reward_coins || 0) <= 0)
      return NextResponse.json({ error: "Coin reward must be positive" }, { status: 400 })
    if (rewardType === "xp" && Number(body.reward_xp || 0) <= 0)
      return NextResponse.json({ error: "XP reward must be positive" }, { status: 400 })
    if (rewardType === "item" && !body.reward_item_id)
      return NextResponse.json({ error: "Select a shop item to reward" }, { status: 400 })

    const quest = {
      title,
      description: String(body.description || "").trim() || null,
      icon: String(body.icon || "target").trim().slice(0, 40),
      accent: ACCENTS.includes(body.accent) ? body.accent : "violet",
      quest_type: body.quest_type,
      minigame_kind: body.quest_type === "minigame" && MINIGAME_KINDS.includes(body.minigame_kind) ? body.minigame_kind : null,
      requirement_count: requirementCount,
      native_action: body.quest_type === "native" && NATIVE_ACTIONS.includes(body.native_action) ? body.native_action : null,
      cadence: body.cadence,
      starts_at: body.cadence === "seasonal" && body.starts_at ? new Date(body.starts_at).toISOString() : null,
      ends_at: body.cadence === "seasonal" && body.ends_at ? new Date(body.ends_at).toISOString() : null,
      reward_type: rewardType,
      reward_coins: ["coins", "coins_xp"].includes(rewardType) ? Math.max(0, Math.floor(Number(body.reward_coins || 0))) : 0,
      reward_xp: ["xp", "coins_xp"].includes(rewardType) ? Math.max(0, Math.floor(Number(body.reward_xp || 0))) : 0,
      reward_item_id: rewardType === "item" ? Number(body.reward_item_id) : null,
      reward_item_qty: rewardType === "item" ? Math.max(1, Math.floor(Number(body.reward_item_qty || 1))) : 1,
      reward_label: String(body.reward_label || "").trim() || null,
      visibility: VISIBILITIES.includes(body.visibility) ? body.visibility : "all",
      min_level: Math.max(1, Math.floor(Number(body.min_level || 1))),
      max_level: body.max_level ? Math.max(1, Math.floor(Number(body.max_level))) : null,
      max_completions_per_user: Math.max(1, Math.floor(Number(body.max_completions_per_user || 1))),
      is_active: body.is_active !== false,
      sort_order: Math.floor(Number(body.sort_order || 0)),
      created_by: user!.id,
    }

    const { data: created, error } = await supabase.from("quests").insert(quest).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, quest: created, message: "Quest created successfully" })
  } catch (error: any) {
    console.error("Error in quest POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/admin/quests — update the economy caps / integration secrets.
 * Body: { caps: { quest_daily_coin_cap, quest_daily_xp_cap, ad_network_secret, survey_network_secret } }
 */
export async function PUT(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const supabase = createServerClient()
    const updates = body.caps || {}
    const allowed = ["quest_daily_coin_cap", "quest_daily_xp_cap", "ad_network_secret", "survey_network_secret"]

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue
      await supabase.from("admin_settings").upsert({
        setting_key: key,
        setting_value: { value: String(value) },
        updated_at: new Date().toISOString(),
      }, { onConflict: "setting_key" })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in quest caps PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
