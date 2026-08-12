import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: streamId } = await params
    const supabase = createServerClient()
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action === "leave" ? "leave" : "join"

    const { data: stream } = await supabase
      .from("live_streams")
      .select("id, viewer_count, max_viewers, status")
      .eq("id", streamId)
      .single()

    if (!stream) {
      return NextResponse.json({ error: "Stream not found" }, { status: 404 })
    }

    if (action === "join") {
      await supabase.from("stream_viewers").upsert(
        {
          stream_id: streamId,
          user_id: user.id,
          joined_at: new Date().toISOString(),
          left_at: null,
        },
        { onConflict: "stream_id,user_id" },
      )

      // Best-effort RPC, then fallback update
      try {
        await supabase.rpc("increment_stream_viewers", { stream_uuid: streamId })
      } catch {
        const next = Number(stream.viewer_count || 0) + 1
        await supabase
          .from("live_streams")
          .update({
            viewer_count: next,
            max_viewers: Math.max(Number(stream.max_viewers || 0), next),
          })
          .eq("id", streamId)
      }
    } else {
      await supabase
        .from("stream_viewers")
        .update({ left_at: new Date().toISOString() })
        .eq("stream_id", streamId)
        .eq("user_id", user.id)
        .is("left_at", null)

      try {
        await supabase.rpc("decrement_stream_viewers", { stream_uuid: streamId })
      } catch {
        await supabase
          .from("live_streams")
          .update({ viewer_count: Math.max(0, Number(stream.viewer_count || 1) - 1) })
          .eq("id", streamId)
      }
    }

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error("Stream viewers error:", error)
    return NextResponse.json({ error: "Failed to update viewer" }, { status: 500 })
  }
}
