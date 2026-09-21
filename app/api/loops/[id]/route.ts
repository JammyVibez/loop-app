import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoop } from "@/lib/normalize-loop"
import { getUserFromRequest } from "@/lib/server-auth"
import { canViewProfile } from "@/lib/privacy"
import { applyRealCommentCounts, applyRealBranchCounts } from "@/lib/loop-stats" 
import { normalizeBranchLimit } from "@/lib/branch-limits"

export const dynamic = "force-dynamic"

async function getLoopWithRelations(loopId: string, userId?: string) {
  const supabase = createServerClient()
  const { data: loop, error } = await supabase
    .from("loops")
    .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member, is_sponsor, is_premium, active_cosmetics, cosmetics, badge_id),
      parent_loop:loops!parent_loop_id(id, content_text, content_title, author_id, author:profiles!author_id(username, display_name, avatar_url, video_avatar_url, is_verified)),
      loop_stats(likes_count, comments_count, branches_count, shares_count, views_count),
      loop_polls(*),
      loop_duels(
        *,
        creator:profiles!creator_id (id, username, display_name, avatar_url, video_avatar_url),
        opponent:profiles!opponent_id (id, username, display_name, avatar_url, video_avatar_url),
        entries:loop_duel_entries (id, side, title, content, media_url, votes_count, user_id)
      )
    `)
    .eq("id", loopId)
    .single()

  if (error || !loop) return { loop: null, branches: [], parentLoop: null, error }

  let interactionTypes: string[] = []
  if (userId) {
    const { data: interactions } = await supabase
      .from("loop_interactions")
      .select("interaction_type")
      .eq("loop_id", loopId)
      .eq("user_id", userId)
    interactionTypes = (interactions || []).map((interaction) => interaction.interaction_type)
  }

  const { data: branchData } = await supabase
    .from("loops")
    .select(`
      id, content_title, content_text, created_at,
      author:profiles!author_id(id, username, display_name, avatar_url, video_avatar_url, active_cosmetics, cosmetics, badge_id)
    `)
    .eq("parent_loop_id", loopId)
    .order("created_at", { ascending: false })
    .limit(50)

  let parentLoop: any = null
  if (loop.parent_loop_id) {
    const { data: parentData } = await supabase
      .from("loops")
      .select(`id, content_title, author:profiles!author_id(username, display_name, is_verified)`)
      .eq("id", loop.parent_loop_id)
      .maybeSingle()
    if (parentData) {
      const parentAuthor = Array.isArray(parentData.author) ? parentData.author[0] : parentData.author
      parentLoop = {
        id: parentData.id,
        title: parentData.content_title || "Untitled Loop",
        author: parentAuthor?.username || parentAuthor?.display_name || "",
        author_verified: Boolean(parentAuthor?.is_verified),
      }
    }
  }

  const [withComments] = await applyRealCommentCounts(supabase, [
    {
      ...loop,
      loop_stats:
        Array.isArray(loop.loop_stats) && loop.loop_stats.length
          ? loop.loop_stats[0]
          : loop.loop_stats,
    },
  ])
  const [normalized] = await applyRealBranchCounts(supabase, [withComments])
  const normalizedLoop = normalizeLoop(normalized, interactionTypes)
  const branches = (branchData || []).map((branch: any) => {
    const author = Array.isArray(branch.author) ? branch.author[0] : branch.author
    return {
      id: branch.id,
      title: branch.content_title || branch.content_text?.slice(0, 48) || "Untitled Loop",
      author: author?.username || "",
      avatar: author?.avatar_url || "/placeholder.svg",
      createdAt: branch.created_at,
    }
  })

  return {
    loop: {
      ...normalizedLoop,
      stats: {
        ...normalizedLoop.stats,
        branches_count: Math.max(normalizedLoop.stats.branches_count, branches.length),
      },
    },
    branches,
    parentLoop,
    error: null,
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    const { loop, branches, parentLoop, error } = await getLoopWithRelations(id, user?.id)

    if (error || !loop) {
      return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    }

    // A loop from a private/followers-only profile is only viewable by the
    // missing loop so the URL doesn't leak private content.
    if (loop.author_id) {
      const supabase = createServerClient()
      const { allowed } = await canViewProfile(supabase, user?.id || null, loop.author_id)
      if (!allowed) {
        return NextResponse.json({ error: "Loop not found" }, { status: 404 })
      }
    }

    return NextResponse.json({ success: true, loop, branches, parentLoop })
  } catch (error: any) {
    console.error("Get loop error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: existingLoop, error: fetchError } = await supabase
      .from("loops")
      .select("author_id")
      .eq("id", id)
      .single()

    if (fetchError || !existingLoop) return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    if (existingLoop.author_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.content_text !== undefined || body.content !== undefined) {
      updates.content_text = String(body.content_text ?? body.content).trim()
    }
    if (body.content_title !== undefined || body.title !== undefined) {
      updates.content_title = body.content_title ?? body.title
    }
    if (Array.isArray(body.hashtags)) {
      updates.hashtags = body.hashtags.map((tag: unknown) => String(tag).replace(/^#/, "").toLowerCase().trim()).filter(Boolean)
    }
    if (body.visibility === "public" || body.visibility === "private") {
      updates.visibility = body.visibility
    }
    // Link previews are author-controlled: turning this on hides the rich
    // card for every viewer until the author turns it back off.
    if (typeof body.link_preview_disabled === "boolean") {
      updates.link_preview_disabled = body.link_preview_disabled
    }

    // Owner-configurable branch tree limits. `null` or 0 means unlimited.
    if (body.max_branch_depth !== undefined) {
      updates.max_branch_depth = normalizeBranchLimit(body.max_branch_depth)
    }
    if (body.max_branches_per_user !== undefined) {
      updates.max_branches_per_user = normalizeBranchLimit(body.max_branches_per_user)
    }

    if (typeof body.is_pinned === "boolean") {
      if (body.is_pinned) {
        const { count } = await supabase
          .from("loops")
          .select("id", { count: "exact", head: true })
          .eq("author_id", user.id)
          .eq("is_pinned", true)
        if ((count || 0) >= 3) {
          return NextResponse.json({ error: "You can pin up to 3 loops. Unpin one first." }, { status: 400 })
        }
      }
      updates.is_pinned = body.is_pinned
    }

    const loopSelect = `
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_team_member, is_sponsor, is_premium, active_cosmetics, cosmetics, badge_id),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `

    let { data: loop, error } = await supabase
      .from("loops")
      .update(updates)
      .eq("id", id)
      .select(loopSelect)
      .single()

    // Pre-migration database: the newer optional columns don't exist yet, so
    // drop just those keys and retry rather than failing the whole edit.
    if (error?.code === "PGRST204") {
      const OPTIONAL_COLUMNS = ["link_preview_disabled", "max_branch_depth", "max_branches_per_user"]
      const optionalKeys = OPTIONAL_COLUMNS.filter((column) => column in updates)
      if (optionalKeys.length && new RegExp(optionalKeys.join("|"), "i").test(error.message || "")) {
        const fallback = { ...updates }
        for (const key of optionalKeys) delete fallback[key]
        ;({ data: loop, error } = await supabase
          .from("loops")
          .update(fallback)
          .eq("id", id)
          .select(loopSelect)
          .single())
      }
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, loop: normalizeLoop(loop) })
  } catch (error: any) {
    console.error("Update loop error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: existingLoop, error: fetchError } = await supabase
      .from("loops")
      .select("author_id")
      .eq("id", id)
      .single()

    if (fetchError || !existingLoop) return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    if (existingLoop.author_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { error } = await supabase.from("loops").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete loop error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}
