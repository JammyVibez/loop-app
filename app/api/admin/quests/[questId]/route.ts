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
