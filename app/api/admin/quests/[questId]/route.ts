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
 * PUT /api/admin/quests/[questId] — update a quest (all fields editable).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { questId } = await params
    const body = await request.json().catch(() => ({}))
    const supabase = createServerClient()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim()
    if (typeof body.description === "string") updates.description = body.description.trim() || null
    if (typeof body.icon === "string") updates.icon = body.icon.trim().slice(0, 40)
    if (ACCENTS.includes(body.accent)) updates.accent = body.accent
    if (QUEST_TYPES.includes(body.quest_type)) {
      updates.quest_type = body.quest_type
      updates.minigame_kind =
        body.quest_type === "minigame" && MINIGAME_KINDS.includes(body.minigame_kind) ? body.minigame_kind : null
      updates.native_action =
        body.quest_type === "native" && NATIVE_ACTIONS.includes(body.native_action) ? body.native_action : null
    } else if (MINIGAME_KINDS.includes(body.minigame_kind)) {
      updates.minigame_kind = body.minigame_kind
    } else if (NATIVE_ACTIONS.includes(body.native_action)) {
      updates.native_action = body.native_action
    }
    if (body.requirement_count !== undefined) {
      updates.requirement_count = Math.max(1, Math.floor(Number(body.requirement_count || 1)))
    }
    if (CADENCES.includes(body.cadence)) {
      updates.cadence = body.cadence
      updates.starts_at = body.cadence === "seasonal" && body.starts_at ? new Date(body.starts_at).toISOString() : null
      updates.ends_at = body.cadence === "seasonal" && body.ends_at ? new Date(body.ends_at).toISOString() : null
    } else {
      if (body.starts_at !== undefined) updates.starts_at = body.starts_at ? new Date(body.starts_at).toISOString() : null
      if (body.ends_at !== undefined) updates.ends_at = body.ends_at ? new Date(body.ends_at).toISOString() : null
    }
    if (REWARD_TYPES.includes(body.reward_type)) {
      updates.reward_type = body.reward_type
      updates.reward_coins = ["coins", "coins_xp"].includes(body.reward_type)
        ? Math.max(0, Math.floor(Number(body.reward_coins || 0)))
        : 0
      updates.reward_xp = ["xp", "coins_xp"].includes(body.reward_type)
        ? Math.max(0, Math.floor(Number(body.reward_xp || 0)))
        : 0
      updates.reward_item_id = body.reward_type === "item" && body.reward_item_id ? Number(body.reward_item_id) : null
      updates.reward_item_qty =
        body.reward_type === "item" ? Math.max(1, Math.floor(Number(body.reward_item_qty || 1))) : 1
    }
    if (typeof body.reward_label === "string") updates.reward_label = body.reward_label.trim() || null
    if (VISIBILITIES.includes(body.visibility)) updates.visibility = body.visibility
    if (body.min_level !== undefined) updates.min_level = Math.max(1, Math.floor(Number(body.min_level || 1)))
    if (body.max_level !== undefined)
      updates.max_level = body.max_level ? Math.max(1, Math.floor(Number(body.max_level))) : null
    if (body.max_completions_per_user !== undefined) {
      updates.max_completions_per_user = Math.max(1, Math.floor(Number(body.max_completions_per_user || 1)))
    }
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active
    if (body.sort_order !== undefined) updates.sort_order = Math.floor(Number(body.sort_order) || 0)

    /* v2 fields */
    if (["draft", "active", "paused", "archived"].includes(body.status)) {
      updates.status = body.status
      updates.is_active = body.status === "active"
    }
    if (body.quest_kind === "mission" || body.quest_kind === "simple") {
      updates.quest_kind = body.quest_kind
      updates.mission_config = body.quest_kind === "mission" && Array.isArray(body.mission_config) ? body.mission_config.slice(0, 12) : []
    } else if (Array.isArray(body.mission_config)) {
      updates.mission_config = body.mission_config.slice(0, 12)
    }
    if (body.banner_url !== undefined) updates.banner_url = String(body.banner_url).trim() || null
    if (body.thumbnail_url !== undefined) updates.thumbnail_url = String(body.thumbnail_url).trim() || null
    if (body.category !== undefined) updates.category = String(body.category).trim() || null
    if (["easy", "medium", "hard"].includes(body.difficulty)) updates.difficulty = body.difficulty
    if (body.est_minutes !== undefined) updates.est_minutes = body.est_minutes ? Math.max(1, Math.floor(Number(body.est_minutes))) : null
    if (body.sponsor_name !== undefined) updates.sponsor_name = String(body.sponsor_name).trim() || null
    if (body.sponsor_url !== undefined) updates.sponsor_url = String(body.sponsor_url).trim() || null
    if (body.cta_text !== undefined) updates.cta_text = String(body.cta_text).trim() || null
    if (body.terms_text !== undefined) updates.terms_text = String(body.terms_text).trim() || null
    if (typeof body.featured === "boolean") updates.featured = body.featured
    if (typeof body.is_sponsored === "boolean") updates.is_sponsored = body.is_sponsored
    if (typeof body.auto_claim === "boolean") updates.auto_claim = body.auto_claim
    if (body.video_url !== undefined) updates.video_url = String(body.video_url).trim() || null
    if (body.video_seconds !== undefined) updates.video_seconds = body.video_seconds ? Math.max(5, Math.floor(Number(body.video_seconds))) : null
    if (body.collection_tag !== undefined) updates.collection_tag = String(body.collection_tag).trim() || null
    if (body.quest_type === "survey" && Array.isArray(body.survey_config)) {
      updates.survey_config = body.survey_config.slice(0, 20)
    }
    if (body.game_config && typeof body.game_config === "object") updates.game_config = body.game_config

    const { data: quest, error } = await supabase
      .from("quests")
      .update(updates)
      .eq("id", questId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, quest, message: "Quest updated successfully" })
  } catch (error: any) {
    console.error("Error in quest PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/quests/[questId] — permanently remove a quest and its progress.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { questId } = await params
    const supabase = createServerClient()
    const { error } = await supabase.from("quests").delete().eq("id", questId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: "Quest deleted successfully" })
  } catch (error: any) {
    console.error("Error in quest DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/admin/quests/[questId] — lifecycle actions.
 * Body: { action: "publish" | "unpublish" | "pause" | "resume" | "archive" | "duplicate" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questId: string }> },
) {
  const { response, user } = await requireAdmin(request)
  if (response) return response

  try {
    const { questId } = await params
    const body = await request.json().catch(() => ({}))
    const action = String(body.action || "")
    const supabase = createServerClient()

    if (action === "duplicate") {
      const { data: src } = await supabase.from("quests").select("*").eq("id", questId).maybeSingle()
      if (!src) return NextResponse.json({ error: "Quest not found" }, { status: 404 })
      const { id: _omit, created_at: _c, updated_at: _u, total_views: _v, total_starts: _s, ...rest } = src as any
      const { data: copy, error } = await supabase
        .from("quests")
        .insert({ ...rest, title: `${src.title} (copy)`, status: "draft", is_active: false })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, quest: copy, message: "Quest duplicated as draft" })
    }

    const statusMap: Record<string, { status: string; is_active: boolean }> = {
      publish: { status: "active", is_active: true },
      unpause: { status: "active", is_active: true },
      resume: { status: "active", is_active: true },
      pause: { status: "paused", is_active: false },
      unpublish: { status: "draft", is_active: false },
      archive: { status: "archived", is_active: false },
    }
    const next = statusMap[action]
    if (!next) return NextResponse.json({ error: "Unknown action" }, { status: 400 })

    const { data: quest, error } = await supabase
      .from("quests")
      .update({ status: next.status, is_active: next.is_active, updated_at: new Date().toISOString() })
      .eq("id", questId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, quest, message: `Quest ${action}d` })
  } catch (error: any) {
    console.error("Error in quest lifecycle POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
