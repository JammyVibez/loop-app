import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

function createServerClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder", {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  const supabase = createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

/**
 * Instagram-style "Moments" strip: recent media from people you follow (last 36h).
 * Reuses loops/reels — no ephemeral stories table required.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()

    const { data: following } = await supabase.from("follows").select("following_id").eq("follower_id", user.id)
    const authorIds = Array.from(new Set([user.id, ...((following || []).map((f) => f.following_id).filter(Boolean))]))

    const { data: loops } = await supabase
      .from("loops")
      .select(
        `
        id, author_id, media_url, media_urls, media_type, content, created_at,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, badge_id)
      `,
      )
      .in("author_id", authorIds)
      .gte("created_at", since)
      .or("media_url.neq.,media_type.eq.image,media_type.eq.video")
      .order("created_at", { ascending: false })
      .limit(80)

    const { data: reels } = await supabase
      .from("reels")
      .select(
        `
        id, author_id, media_url, thumbnail_url, created_at,
        author:profiles!author_id(id, username, display_name, avatar_url, is_verified, badge_id)
      `,
      )
      .in("author_id", authorIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(40)

    type MomentItem = {
      id: string
      type: "loop" | "reel" | "moment"
      media_url: string
      media_type: string
      href: string
      created_at: string
    }

    const byAuthor = new Map<
      string,
      {
        user: any
        items: MomentItem[]
        latest_at: string
        is_self: boolean
      }
    >()

    const pushItem = (author: any, authorId: string, item: MomentItem) => {
      // Moments without media (caption-only) still count; loops/reels need media.
      if (!authorId) return
      if (!item.media_url && item.type !== "moment") return
      const existing = byAuthor.get(authorId) || {
        user: author || { id: authorId },
        items: [] as MomentItem[],
        latest_at: item.created_at,
        is_self: authorId === user.id,
      }
      existing.items.push(item)
      if (item.created_at > existing.latest_at) existing.latest_at = item.created_at
      byAuthor.set(authorId, existing)
    }

    for (const loop of loops || []) {
      const mediaUrl = loop.media_url || (Array.isArray(loop.media_urls) ? loop.media_urls[0] : null)
      if (!mediaUrl) continue
      const author = Array.isArray(loop.author) ? loop.author[0] : loop.author
      pushItem(author, loop.author_id, {
        id: loop.id,
        type: "loop" as const,
        media_url: mediaUrl,
        media_type: loop.media_type || "image",
        href: `/loop/${loop.id}`,
        created_at: loop.created_at,
      })
    }

    for (const reel of reels || []) {
      const mediaUrl = reel.media_url || reel.thumbnail_url
      if (!mediaUrl) continue
      const author = Array.isArray(reel.author) ? reel.author[0] : reel.author
      pushItem(author, reel.author_id, {
        id: reel.id,
        type: "reel" as const,
        media_url: mediaUrl,
        media_type: "video",
        href: `/reels?id=${reel.id}`,
        created_at: reel.created_at,
      })
    }

    // Real ephemeral Moments (24-48h posts from the `moments` table) are
    // merged into the strip so the two concepts live in one rail.
    const { data: realMoments } = await supabase
      .from("moments")
      .select(
        `id, user_id, media_url, media_type, content, created_at, expires_at,
         author:profiles!user_id(id, username, display_name, avatar_url, is_verified)`,
      )
      .in("user_id", authorIds)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(80)

    for (const real of realMoments || []) {
      const author = Array.isArray(real.author) ? real.author[0] : real.author
      pushItem(author, real.user_id, {
        id: real.id,
        type: "moment" as const,
        media_url: real.media_url || "",
        media_type: real.media_type || "image",
        href: `/moments/${real.id}`,
        created_at: real.created_at,
      })
    }

    // Always surface "Your moment" first even if empty (prompt to create)
    if (!byAuthor.has(user.id)) {
      const { data: me } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified")
        .eq("id", user.id)
        .maybeSingle()
      byAuthor.set(user.id, {
        user: me || { id: user.id },
        items: [],
        latest_at: new Date(0).toISOString(),
        is_self: true,
      })
    }

    const moments = Array.from(byAuthor.values())
      .map((m) => ({
        ...m,
        items: m.items.slice(0, 8),
        has_unseen: !m.is_self && m.items.length > 0,
      }))
      .sort((a, b) => {
        if (a.is_self) return -1
        if (b.is_self) return 1
        return b.latest_at.localeCompare(a.latest_at)
      })
      .slice(0, 24)

    return NextResponse.json({ success: true, moments })
  } catch (error) {
    console.error("Moments API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
