import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoop } from "@/lib/normalize-loop"

async function getUser(request: NextRequest) {
  const supabase = createServerClient()
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
  if (!token) return null
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function getLoopWithRelations(loopId: string, userId?: string) {
  const supabase = createServerClient()
  const { data: loop, error } = await supabase
    .from("loops")
    .select(`
      *,
      author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
      loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
    `)
    .eq("id", loopId)
    .single()

  if (error || !loop) return { loop: null, error }

  let interactionTypes: string[] = []
  if (userId) {
    const { data: interactions } = await supabase
      .from("loop_interactions")
      .select("interaction_type")
      .eq("loop_id", loopId)
      .eq("user_id", userId)
    interactionTypes = (interactions || []).map((interaction) => interaction.interaction_type)
  }

  return { loop: normalizeLoop(loop, interactionTypes), error: null }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUser(request)
    const { loop, error } = await getLoopWithRelations(id, user?.id)

    if (error || !loop) {
      return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, loop })
  } catch (error: any) {
    console.error("Get loop error:", error)
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUser(request)
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

    const { data: loop, error } = await supabase
      .from("loops")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
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
    const user = await getUser(request)
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
