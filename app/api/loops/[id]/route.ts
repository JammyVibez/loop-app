import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoop } from "@/lib/normalize-loop"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

async function getLoopWithRelations(loopId: string, userId?: string) {
  const supabase = createServerClient()
  const { data: loop, error } = await supabase
    .from("loops")
    .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium, active_cosmetics, cosmetics),
      parent_loop:loops!parent_loop_id(id, content_text, content_title, author_id, author:profiles!author_id(username, display_name, avatar_url)),
      loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
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
      author:profiles!author_id(id, username, display_name, avatar_url, active_cosmetics, cosmetics)
    `)
    .eq("parent_loop_id", loopId)
    .order("created_at", { ascending: false })
    .limit(50)

  let parentLoop: any = null
  if (loop.parent_loop_id) {
    const { data: parentData } = await supabase
      .from("loops")
      .select(`id, content_title, author:profiles!author_id(username, display_name)`)
      .eq("id", loop.parent_loop_id)
      .maybeSingle()
    if (parentData) {
      const parentAuthor = Array.isArray(parentData.author) ? parentData.author[0] : parentData.author
      parentLoop = {
        id: parentData.id,
        title: parentData.content_title || "Untitled Loop",
        author: parentAuthor?.username || parentAuthor?.display_name || "",
      }
    }
  }

  const normalized = normalizeLoop(loop, interactionTypes)
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
      ...normalized,
      stats: {
        ...normalized.stats,
        branches_count: Math.max(normalized.stats.branches_count, branches.length),
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

    const { data: loop, error } = await supabase
      .from("loops")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium, active_cosmetics, cosmetics),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .single()

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
