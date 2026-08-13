import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { normalizeLoops } from "@/lib/normalize-loop"
import { requireAdmin } from "@/lib/server-auth"

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response
  const supabase = createServerClient()

  const { data: loops, error } = await supabase
    .from("loops")
    .select(`
      id, content, content_text, content_title, hashtags, is_featured, created_at, visibility,
      author:profiles!author_id(id, username, display_name, avatar_url),
      loop_stats(likes_count, comments_count, views_count)
    `)
    .is("parent_loop_id", null)
    .order("created_at", { ascending: false })
    .limit(40)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: featured } = await supabase
    .from("loops")
    .select(`
      id, content, content_text, content_title, hashtags, is_featured, created_at,
      author:profiles!author_id(id, username, display_name, avatar_url),
      loop_stats(likes_count, comments_count, views_count)
    `)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json({
    success: true,
    loops: normalizeLoops(loops || []),
    featured: normalizeLoops(featured || []),
  })
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response
  const supabase = createServerClient()
  const body = await request.json().catch(() => ({}))
  const loopId = body.loop_id
  const featured = body.featured !== false && body.action !== "unfeature"

  if (!loopId) return NextResponse.json({ error: "loop_id required" }, { status: 400 })

  const { data, error } = await supabase
    .from("loops")
    .update({ is_featured: featured, updated_at: new Date().toISOString() })
    .eq("id", loopId)
    .select("id, is_featured")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, loop: data })
}
