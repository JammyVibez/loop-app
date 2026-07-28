import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeLoops } from "@/lib/normalize-loop"
import { smartEngagementScore } from "@/lib/feed-ranking"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function statsOf(_loop: any) {
  return null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tag: string }> },
) {
  try {
    const { tag: raw } = await params
    const tag = String(raw || "")
      .replace(/^#/, "")
      .toLowerCase()
      .trim()

    if (!tag) return NextResponse.json({ error: "Tag required" }, { status: 400 })

    const supabase = createServerClient()

    const [{ data: hashtagInfo }, { data: loops, error: loopsError }, { data: related }] = await Promise.all([
      supabase.from("hashtags").select("*").eq("tag", tag).maybeSingle(),
      supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .contains("hashtags", [tag])
        .eq("visibility", "public")
        .is("parent_loop_id", null)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("hashtags")
        .select("tag, usage_count")
        .neq("tag", tag)
        .order("usage_count", { ascending: false })
        .limit(12),
    ])

    if (loopsError) {
      // Fallback: scan recent loops and filter client-side if contains fails
      console.error("hashtag loops query:", loopsError)
    }

    let rows = loops || []
    if (!rows.length) {
      const { data: recent } = await supabase
        .from("loops")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
          loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
        `)
        .not("hashtags", "is", null)
        .eq("visibility", "public")
        .is("parent_loop_id", null)
        .order("created_at", { ascending: false })
        .limit(200)
      rows = (recent || []).filter((loop) =>
        (loop.hashtags || []).some((t: string) => String(t).toLowerCase().replace(/^#/, "") === tag),
      )
    }

    const normalized = normalizeLoops(rows).map((loop, i) => ({
      ...loop,
      engagement_score: smartEngagementScore(rows[i] || loop),
    }))

    const usage =
      Number(hashtagInfo?.usage_count || 0) ||
      normalized.length ||
      0

    return NextResponse.json({
      success: true,
      tag,
      hashtag: hashtagInfo || { tag, usage_count: usage },
      count: usage,
      trending: Number(hashtagInfo?.trending_score || 0) > 5 || usage >= 5,
      description: `Explore loops tagged with #${tag}`,
      relatedTags: (related || []).map((r) => r.tag),
      loops: normalized,
      top: [...normalized].sort(
        (a, b) => Number(b.stats?.likes_count || 0) - Number(a.stats?.likes_count || 0),
      ),
    })
  } catch (error: any) {
    console.error("Hashtag API error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
