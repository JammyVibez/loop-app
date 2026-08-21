import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireUser } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, response } = await requireUser(request)
    if (!user) return response

    const supabase = createServerClient()
    const { data: reel } = await supabase.from("reels").select("author_id").eq("id", id).single()
    if (!reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 })
    if (reel.author_id !== user.id) {
      return NextResponse.json({ error: "You can only edit your own reels" }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}
    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim()
    if (typeof body.description === "string") updates.description = body.description.trim()
    if (Array.isArray(body.hashtags)) updates.hashtags = body.hashtags.filter(Boolean).map((t: string) => t.toLowerCase())
    if (body.effects !== undefined) updates.effects = body.effects

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("reels")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        author:profiles!author_id (id, username, display_name, avatar_url, video_avatar_url, is_verified)
      `)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: { reel: { ...updated, type: updated.content_type } } })
  } catch (error) {
    console.error("Edit reel error:", error)
    return NextResponse.json({ error: "Failed to edit reel" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, response } = await requireUser(request)
    if (!user) return response

    const supabase = createServerClient()
    const { data: reel } = await supabase.from("reels").select("author_id").eq("id", id).single()
    if (!reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 })
    if (reel.author_id !== user.id) {
      return NextResponse.json({ error: "You can only delete your own reels" }, { status: 403 })
    }

    // Clean up dependent rows (branches are reels rows with parent_reel_id)
    await supabase.from("reels").delete().eq("parent_reel_id", id)
    await supabase.from("reel_comments").delete().eq("reel_id", id)
    await supabase.from("reel_interactions").delete().eq("reel_id", id)

    const { error } = await supabase.from("reels").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete reel error:", error)
    return NextResponse.json({ error: "Failed to delete reel" }, { status: 500 })
  }
}
