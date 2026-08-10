import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { normalizeLoop } from "@/lib/normalize-loop"
import { awardXp } from "@/lib/xp"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

async function getUser(token: string | null) {
  if (!token) return null
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

/**
 * Fork a loop (especially code loops) into the current user's profile.
 * Creates a new root loop with metadata.forked_from pointing at the source.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: sourceId } = await context.params
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 280) : ""

    const { data: source, error: sourceError } = await supabase
      .from("loops")
      .select("*")
      .eq("id", sourceId)
      .maybeSingle()

    if (sourceError || !source) {
      return NextResponse.json({ error: "Loop not found" }, { status: 404 })
    }

    if (source.author_id === user.id) {
      return NextResponse.json({ error: "You already own this loop" }, { status: 400 })
    }

    const sourceMeta =
      source.content_metadata && typeof source.content_metadata === "object" ? source.content_metadata : {}
    const isCode =
      source.content_type === "code" ||
      source.media_type === "code" ||
      source.category === "code" ||
      Boolean((sourceMeta as any).is_code)

    const contentText = String(source.content_text || source.content || "")
    const title = String(source.content_title || "").slice(0, 120)
    const forkMeta = {
      ...sourceMeta,
      is_code: isCode || Boolean((sourceMeta as any).is_code),
      language: (sourceMeta as any).language || "other",
      forked_from: sourceId,
      forked_from_author: source.author_id,
      forked_at: new Date().toISOString(),
    }

    const payload: Record<string, unknown> = {
      author_id: user.id,
      content: note || (isCode ? `Forked code loop` : contentText.slice(0, 500)) || "Forked loop",
      content_text: note ? `${note}\n\n${contentText}`.trim() : contentText,
      content_title: title ? `Fork: ${title}` : "Forked loop",
      content_type: isCode ? "code" : source.content_type || "text",
      media_type: isCode ? "code" : source.media_type || source.content_type || "text",
      category: isCode ? "code" : source.category || "general",
      hashtags: source.hashtags || [],
      parent_loop_id: null,
      visibility: "public",
      tree_depth: 0,
      content_metadata: forkMeta,
      content_media_url: source.content_media_url || source.media_url || null,
      media_url: source.media_url || source.content_media_url || null,
    }

    let { data: fork, error } = await supabase
      .from("loops")
      .insert(payload)
      .select(`
        *,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
        loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
      `)
      .single()

    // Fallback if content_type "code" rejected by CHECK
    if (error && /content_type|check|code/i.test(error.message || "")) {
      payload.content_type = "text"
      payload.media_type = "text"
      ;({ data: fork, error } = await supabase
        .from("loops")
        .insert(payload)
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .single())
    }

    if (error || !fork) {
      return NextResponse.json({ error: error?.message || "Failed to fork" }, { status: 500 })
    }

    await supabase.from("loop_stats").upsert(
      {
        loop_id: fork.id,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        views_count: 0,
        branches_count: 0,
      },
      { onConflict: "loop_id", ignoreDuplicates: true },
    )

    // Bump fork count on source metadata
    const nextForks = Number((sourceMeta as any).forks_count || 0) + 1
    await supabase
      .from("loops")
      .update({
        content_metadata: { ...sourceMeta, forks_count: nextForks, is_code: isCode || (sourceMeta as any).is_code },
        updated_at: new Date().toISOString(),
      })
      .eq("id", sourceId)

    try {
      await awardXp(supabase, user.id, 10, "Forked a loop")
      if (source.author_id) {
        await awardXp(supabase, source.author_id, 5, "Your loop was forked")
        await supabase.from("notifications").insert({
          user_id: source.author_id,
          type: "system",
          title: "Your loop was forked",
          message: "Someone forked your loop into their profile",
          data: { loop_id: sourceId, fork_id: fork.id, user_id: user.id },
          actor_id: user.id,
        })
      }
    } catch {
      /* optional */
    }

    return NextResponse.json({
      success: true,
      loop: normalizeLoop(fork),
      forks_count: nextForks,
    })
  } catch (error: any) {
    console.error("Fork error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
