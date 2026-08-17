import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Ephemeral moments (24–48h) shown as unique post cards — NOT an
 * Instagram-style story strip.
 *
 * GET purges every expired moment from the database (the "auto-delete"
 * guarantee), then returns a flat list of still-live moments from people the
 * viewer follows plus their own.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const now = new Date().toISOString()

    // Auto-delete: moments past their 24/48h life are removed from the DB
    // entirely on first read — no cron needed, nothing lingers.
    const { error: purgeError } = await supabase.from("moments").delete().lt("expires_at", now)
    if (purgeError) console.error("Moments purge error:", purgeError.message)

    // Active moments from people the viewer follows + their own.
    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
    const authorIds = Array.from(new Set([user.id, ...((following || []).map((f) => f.following_id).filter(Boolean))]))

    const { data: moments, error } = await supabase
      .from("moments")
      .select(
        `*,
         author:profiles!user_id(id, username, display_name, avatar_url, is_verified),
         comments:moment_comments(id)`,
      )
      .in("user_id", authorIds)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(80)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Flat card list — each entry carries its author + real stats inline.
    const cards = (moments || []).map((moment) => {
      const author = Array.isArray(moment.author) ? moment.author[0] : moment.author
      const commentList = Array.isArray(moment.comments) ? moment.comments : []
      return {
        id: moment.id,
        user_id: moment.user_id,
        media_url: moment.media_url,
        media_type: moment.media_type || "image",
        content: moment.content,
        created_at: moment.created_at,
        expires_at: moment.expires_at,
        view_count: Number(moment.view_count || 0),
        comment_count: commentList.length,
        duration_hours: Math.max(24, Math.min(48, Math.round((new Date(moment.expires_at).getTime() - new Date(moment.created_at).getTime()) / 36e5))),
        is_self: moment.user_id === user.id,
        author: author || { id: moment.user_id },
      }
    })

    return NextResponse.json({ success: true, moments: cards })
  } catch (error: any) {
    console.error("Moments GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Create a moment. Body: { media_url, media_type?, content?, hours? (24|36|48, default 24) } */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const mediaUrl = String(body.media_url || "").trim()
    const content = String(body.content || "").trim().slice(0, 500)
    const mediaType = String(body.media_type || (mediaUrl.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? "video" : "image")).trim()
    let hours = Number(body.hours || 24)
    if (!Number.isFinite(hours)) hours = 24
    hours = Math.min(48, Math.max(24, hours))

    if (!mediaUrl && !content) {
      return NextResponse.json({ error: "A photo, video, or caption is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Pro users can post 48h moments; free users get 24h.
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, premium_expires_at")
      .eq("id", user.id)
      .maybeSingle()
    const isPro =
      Boolean(profile?.is_premium) &&
      (!profile?.premium_expires_at || new Date(profile.premium_expires_at) > new Date())
    if (!isPro && hours > 24) hours = 24

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

    const { data: moment, error } = await supabase
      .from("moments")
      .insert({
        user_id: user.id,
        media_url: mediaUrl || null,
        media_type: mediaType,
        content: content || null,
        expires_at: expiresAt,
      })
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, moment })
  } catch (error: any) {
    console.error("Moments POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
