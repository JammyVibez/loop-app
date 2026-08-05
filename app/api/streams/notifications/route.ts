import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { notifyUsers } from "@/lib/notifications"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { streamId, action } = await request.json()

    if (!streamId || !["start", "end"].includes(action)) {
      return NextResponse.json({ error: "streamId and action (start|end) required" }, { status: 400 })
    }

    const { data: stream, error: streamError } = await supabase
      .from("live_streams")
      .select(
        `
        *,
        streamer:profiles!streamer_id(
          id,
          username,
          display_name,
          avatar_url
        )
      `,
      )
      .eq("id", streamId)
      .eq("streamer_id", user.id)
      .single()

    if (streamError || !stream) {
      return NextResponse.json({ error: "Stream not found or access denied" }, { status: 404 })
    }

    const streamer = Array.isArray(stream.streamer) ? stream.streamer[0] : stream.streamer

    if (action === "start") {
      await supabase
        .from("live_streams")
        .update({
          status: "live",
          started_at: stream.started_at || new Date().toISOString(),
        })
        .eq("id", streamId)

      // Best-effort is_live column for older schemas
      try {
        await supabase.from("live_streams").update({ is_live: true }).eq("id", streamId)
      } catch {}

      const { data: followers } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", user.id)

      const followerIds = (followers || []).map((f: any) => f.follower_id).filter(Boolean)
      if (followerIds.length) {
        await notifyUsers(supabase, followerIds, {
          type: "live_stream_started",
          title: `${streamer?.display_name || "A creator"} is live`,
          message: `Started streaming: ${stream.title}`,
          actorId: user.id,
          actionUrl: `/streams/${streamId}`,
          data: {
            stream_id: streamId,
            streamer_id: user.id,
            streamer_username: streamer?.username,
            stream_title: stream.title,
          },
          pushCategory: "liveStreams",
        })
      }

      return NextResponse.json({
        success: true,
        message: "Stream started and push notifications sent",
        notified_followers: followerIds.length,
      })
    }

    await supabase
      .from("live_streams")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      })
      .eq("id", streamId)

    try {
      await supabase.from("live_streams").update({ is_live: false }).eq("id", streamId)
    } catch {}

    return NextResponse.json({ success: true, message: "Stream ended" })
  } catch (error: any) {
    console.error("Stream notifications error:", error)
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: following } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)

    const ids = (following || []).map((f: any) => f.following_id)
    if (!ids.length) return NextResponse.json({ success: true, streams: [] })

    const { data: streams } = await supabase
      .from("live_streams")
      .select(
        `
        id, title, thumbnail_url, viewer_count, category, status, started_at,
        streamer:profiles!streamer_id(id, username, display_name, avatar_url)
      `,
      )
      .in("streamer_id", ids)
      .eq("status", "live")
      .order("viewer_count", { ascending: false })
      .limit(20)

    return NextResponse.json({ success: true, streams: streams || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 })
  }
}
