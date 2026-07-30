import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
  if (!token) return null
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser(token)
  return user || null
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUser(request)
    const { searchParams } = new URL(request.url)

    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const category = searchParams.get("category") || "trending"
    const hashtag = searchParams.get("hashtag")
    const offset = (page - 1) * limit

    let query = supabase
      .from("reels")
      .select(`
        *,
        author:profiles!author_id (
          id,
          username,
          display_name,
          avatar_url,
          is_verified,
          is_premium
        )
      `)
      .eq("visibility", "public")
      .range(offset, offset + limit - 1)

    switch (category) {
      case "trending":
        query = query.order("like_count", { ascending: false }).order("view_count", { ascending: false })
        break
      case "following":
        if (user) {
          const { data: following } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", user.id)
          const ids = (following || []).map((f) => f.following_id)
          if (ids.length) query = query.in("author_id", ids)
          else query = query.eq("author_id", "00000000-0000-0000-0000-000000000000")
        }
        query = query.order("created_at", { ascending: false })
        break
      case "recent":
      default:
        query = query.order("created_at", { ascending: false })
    }

    if (hashtag) query = query.contains("hashtags", [hashtag])

    const { data: reels, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let liked = new Set<string>()
    let saved = new Set<string>()
    if (user && reels?.length) {
      const { data: interactions } = await supabase
        .from("reel_interactions")
        .select("reel_id, interaction_type")
        .eq("user_id", user.id)
        .in(
          "reel_id",
          reels.map((r) => r.id),
        )
      for (const row of interactions || []) {
        if (row.interaction_type === "like") liked.add(row.reel_id)
        if (row.interaction_type === "save") saved.add(row.reel_id)
      }
    }

    let processed = (reels || []).map((reel) => ({
      ...reel,
      type: reel.content_type,
      is_liked: liked.has(reel.id),
      is_saved: saved.has(reel.id),
    }))

    // Fallback: surface video loops so the feed is never empty
    if (!processed.length && page === 1) {
      const { data: videoLoops } = await supabase
        .from("loops")
        .select(`
          id, author_id, content, content_text, media_url, content_media_url, media_type, hashtags, created_at,
          author:profiles!author_id (id, username, display_name, avatar_url, is_verified, is_premium)
        `)
        .or("media_type.eq.video,content_type.eq.video")
        .order("created_at", { ascending: false })
        .limit(limit)

      processed = (videoLoops || [])
        .map((loop: any) => {
          const url = loop.media_url || loop.content_media_url
          if (!url) return null
          return {
            id: loop.id,
            author_id: loop.author_id,
            title: (loop.content_text || loop.content || "Loop reel").slice(0, 80),
            description: loop.content_text || loop.content || "",
            content_type: "video",
            type: "video",
            content_url: url,
            thumbnail_url: null,
            hashtags: loop.hashtags || [],
            like_count: 0,
            comment_count: 0,
            share_count: 0,
            view_count: 0,
            allows_comments: true,
            author: loop.author,
            created_at: loop.created_at,
            is_liked: false,
            is_saved: false,
            source: "loop",
          }
        })
        .filter(Boolean) as any[]
    }

    return NextResponse.json({
      success: true,
      data: {
        reels: processed,
        page,
        limit,
        has_more: (reels?.length || 0) === limit,
      },
    })
  } catch (error) {
    console.error("Get reels error:", error)
    return NextResponse.json({ error: "Failed to fetch reels" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const body = await request.json()
    const {
      title,
      description,
      content_type,
      content_url,
      thumbnail_url,
      duration,
      hashtags,
      music_id,
      effects,
      visibility,
      allows_comments,
      allows_duets,
      allows_downloads,
    } = body

    if (!title?.trim() || !content_type || !content_url) {
      return NextResponse.json({ error: "Title, content_type, and content_url are required" }, { status: 400 })
    }

    const validTypes = ["video", "image", "audio", "text"]
    if (!validTypes.includes(content_type)) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    }

    const { data: reel, error } = await supabase
      .from("reels")
      .insert({
        author_id: user.id,
        title: title.trim(),
        description: description?.trim(),
        content_type,
        content_url,
        thumbnail_url,
        duration: duration || null,
        hashtags: hashtags || [],
        music_id: music_id || null,
        effects: effects || null,
        visibility: visibility || "public",
        allows_comments: allows_comments !== false,
        allows_duets: allows_duets !== false,
        allows_downloads: allows_downloads !== false,
      })
      .select(`
        *,
        author:profiles!author_id (
          id, username, display_name, avatar_url, is_verified
        )
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Broadcast new reel for realtime feeds
    try {
      await supabase.channel("reels:public").send({
        type: "broadcast",
        event: "reel:created",
        payload: { reel: { ...reel, type: reel.content_type } },
      })
    } catch {}

    return NextResponse.json({ success: true, data: { reel: { ...reel, type: reel.content_type } } })
  } catch (error) {
    console.error("Create reel error:", error)
    return NextResponse.json({ error: "Failed to create reel" }, { status: 500 })
  }
}
