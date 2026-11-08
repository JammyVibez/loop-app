import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { enforceUserRateLimit } from "@/lib/rate-limit-settings"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COMMENT_SELECT = "id, title_id, author_id, parent_comment_id, content, created_at, author:profiles!channel_comments_author_id_fkey(id, username, display_name, avatar_url, is_verified)"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: titleId } = await params
  if (!UUID_RE.test(titleId)) return NextResponse.json({ error: "Title not found" }, { status: 404 })

  try {
    const supabase = createServerClient()
    const { data: title, error: titleError } = await supabase
      .from("channel_titles")
      .select("id")
      .eq("id", titleId)
      .eq("published", true)
      .maybeSingle()
    if (titleError) throw new Error(titleError.message)
    if (!title) return NextResponse.json({ error: "Title not found" }, { status: 404 })

    const { data, error } = await supabase
      .from("channel_comments")
      .select(COMMENT_SELECT)
      .eq("title_id", titleId)
      .order("created_at", { ascending: true })
      .limit(1000)
    if (error) throw new Error(error.message)

    const map = new Map<string, Record<string, unknown>>()
    for (const row of data ?? []) {
      const author = Array.isArray(row.author) ? row.author[0] : row.author
      map.set(row.id, { ...row, author, replies: [] as unknown[] })
    }
    const roots: Record<string, unknown>[] = []
    for (const row of data ?? []) {
      const node = map.get(row.id)!
      const parentId = row.parent_comment_id
      const parent = parentId ? map.get(parentId) : null
      if (parent) (parent.replies as unknown[]).push(node)
      else roots.push(node)
    }
    roots.reverse()
    return NextResponse.json({ ok: true, comments: roots })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the discussion"
    console.error("[channels/comments] list failed:", message)
    return NextResponse.json({ error: "Discussion is unavailable right now." }, { status: 502 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: "Sign in to join the discussion." }, { status: 401 })

  const { id: titleId } = await params
  if (!UUID_RE.test(titleId)) return NextResponse.json({ error: "Title not found" }, { status: 404 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const content = typeof body?.content === "string" ? body.content.trim() : ""
  const parentId = typeof body?.parentCommentId === "string" ? body.parentCommentId : null
  if (!content || content.length > 2000) {
    return NextResponse.json({ error: "Comments need 1–2,000 characters." }, { status: 400 })
  }
  if (parentId && !UUID_RE.test(parentId)) return NextResponse.json({ error: "Invalid reply target." }, { status: 400 })

  try {
    const supabase = createServerClient()
    const guard = await enforceUserRateLimit(supabase, "comment", user.id)
    if (!guard.ok) {
      return NextResponse.json(
        { error: `You've hit the comment limit. Try again in ${guard.retryAfter} seconds.` },
        { status: 429, headers: { "Retry-After": String(guard.retryAfter) } },
      )
    }

    const { data: title, error: titleError } = await supabase
      .from("channel_titles")
      .select("id, title")
      .eq("id", titleId)
      .eq("published", true)
      .maybeSingle()
    if (titleError) throw new Error(titleError.message)
    if (!title) return NextResponse.json({ error: "Title not found" }, { status: 404 })

    if (parentId) {
      const { data: parent, error: parentError } = await supabase
        .from("channel_comments")
        .select("id")
        .eq("id", parentId)
        .eq("title_id", titleId)
        .maybeSingle()
      if (parentError) throw new Error(parentError.message)
      if (!parent) return NextResponse.json({ error: "That comment is no longer available." }, { status: 404 })
    }

    const { data: comment, error } = await supabase
      .from("channel_comments")
      .insert({ title_id: titleId, author_id: user.id, parent_comment_id: parentId, content })
      .select(COMMENT_SELECT)
      .single()
    if (error) throw new Error(error.message)

    try {
      const { extractMentions, processMentions } = await import("@/lib/mentions")
      const usernames = extractMentions(content)
      if (usernames.length) {
        await processMentions(supabase, content, {
          source: "loop_comment",
          comment_id: comment.id,
          snippet: `${title.title}: ${content.slice(0, 120)}`,
          actor_id: user.id,
          actor_username: user.user_metadata?.username,
          actor_display_name: user.user_metadata?.display_name || user.email,
        })
      }
    } catch (mentionError) {
      console.warn("[channels/comments] mention processing failed:", mentionError)
    }

    const author = Array.isArray(comment.author) ? comment.author[0] : comment.author
    return NextResponse.json({ ok: true, comment: { ...comment, author, replies: [] } }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not post your comment"
    console.error("[channels/comments] create failed:", message)
    return NextResponse.json({ error: "Could not post your comment right now." }, { status: 502 })
  }
}
