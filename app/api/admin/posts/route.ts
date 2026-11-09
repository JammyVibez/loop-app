import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const POST_FIELDS =
  "id, author_id, content, content_text, content_title, content_media_url, content_type, media_url, media_type, created_at, parent_loop_id, circle_id, visibility, like_count, comment_count, branch_count, is_pinned"

export interface AdminPostRow {
  id: string
  author_id: string
  content: unknown
  content_text: string | null
  content_title: string | null
  content_media_url: string | null
  content_type: string | null
  media_url: string | null
  media_type: string | null
  created_at: string
  parent_loop_id: string | null
  circle_id: string | null
  visibility: string | null
  like_count: number | null
  comment_count: number | null
  branch_count: number | null
  author?: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    is_deleted: boolean | null
  } | null
}

function previewText(row: Record<string, any>): string {
  const text = row.content_text || (typeof row.content === "string" ? row.content : row.content?.text) || ""
  if (text) return String(text)
  const type = row.content_type || row.media_type
  return type && type !== "text" ? `[${type}]` : "(empty post)"
}

/** GET /api/admin/posts?q=&limit= — recent posts across the whole platform. */
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") || "").trim()
    const limit = Math.min(Number.parseInt(searchParams.get("limit") || "40") || 40, 100)

    let query = supabase
      .from("loops")
      .select(`${POST_FIELDS}, author:profiles!author_id(id, username, display_name, avatar_url, is_deleted)`)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (q) query = query.or(`content_text.ilike.%${q}%,content_title.ilike.%${q}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const posts = (data || []).map((row: any) => ({
      ...row,
      preview: previewText(row),
      author: row.author || null,
    }))

    return NextResponse.json({ success: true, posts })
  } catch (error: any) {
    console.error("[admin/posts] GET error:", error)
    return NextResponse.json({ error: error?.message || "Failed to load posts" }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/posts?id=<loopId>
 *
 * Hard-deletes the post. Child rows that declare `ON DELETE CASCADE` on
 * loops.id (comments, reactions, stats, polls, mentions, …) go with it;
 * the two loop-referencing tables without a FK are cleaned up explicitly.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const { searchParams } = new URL(request.url)
    const body = await request.json().catch(() => ({}))
    const id = searchParams.get("id") || body?.id
    if (!id) return NextResponse.json({ error: "Post id is required" }, { status: 400 })

    const supabase = createServerClient()

    const { data: post, error: readError } = await supabase
      .from("loops")
      .select("id, author_id, parent_loop_id, content_title, content_text, media_url, content_media_url, media_urls")
      .eq("id", id)
      .maybeSingle()

    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

    // Tables that reference loops without a cascading FK.
    await supabase.from("loops_tags").delete().eq("loop_id", id)
    await supabase.from("loop_branches").delete().eq("parent_loop_id", id)
    await supabase.from("loop_branches").delete().eq("branch_loop_id", id)

    const { error: deleteError } = await supabase.from("loops").delete().eq("id", id)
    if (deleteError) {
      return NextResponse.json({ error: `Could not delete the post: ${deleteError.message}` }, { status: 500 })
    }

    // Remove the post's uploads from the VPS. Files that another post or
    // profile still uses are left in place.
    try {
      const { collectMediaUrls, deleteMediaByUrls } = await import("@/lib/media/cleanup")
      const urls = collectMediaUrls({
        media_url: (post as any).media_url,
        content_media_url: (post as any).content_media_url,
        media_urls: (post as any).media_urls,
      })
      if (urls.size) await deleteMediaByUrls(urls)
    } catch (cleanupError) {
      console.warn("[admin/posts] media cleanup failed:", cleanupError)
    }

    // Keep the parent's branch count honest when a branch is removed.
    if (post.parent_loop_id) {
      const { data: parent } = await supabase
        .from("loops")
        .select("branch_count")
        .eq("id", post.parent_loop_id)
        .maybeSingle()
      if (parent) {
        await supabase
          .from("loops")
          .update({ branch_count: Math.max(0, Number(parent.branch_count || 0) - 1) })
          .eq("id", post.parent_loop_id)
      }
    }

    return NextResponse.json({ success: true, id })
  } catch (error: any) {
    console.error("[admin/posts] DELETE error:", error)
    return NextResponse.json({ error: error?.message || "Failed to delete post" }, { status: 500 })
  }
}
