import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/** Fetch a single moment (only while it hasn't expired). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createServerClient()
    const { data: moment, error } = await supabase
      .from("moments")
      .select(
        `*,
         author:profiles!user_id(id, username, display_name, avatar_url, video_avatar_url, is_verified)`,
      )
      .eq("id", id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!moment) {
      return NextResponse.json({ error: "Moment not found or expired" }, { status: 404 })
    }

    return NextResponse.json({ success: true, moment })
  } catch (error: any) {
    console.error("Moment GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Edit a moment — only the author (or an admin) may edit. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const content = body.content !== undefined ? String(body.content).trim().slice(0, 500) : undefined
    const mediaUrl = body.media_url !== undefined ? String(body.media_url).trim() : undefined

    if (content === undefined && mediaUrl === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: existing } = await supabase
      .from("moments")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Moment not found" }, { status: 404 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (existing.user_id !== user.id && !profile?.is_admin) {
      return NextResponse.json({ error: "You can only edit your own moments" }, { status: 403 })
    }

    const payload: Record<string, unknown> = {}
    if (content !== undefined) payload.content = content || null
    if (mediaUrl !== undefined) payload.media_url = mediaUrl || null

    const { data: moment, error } = await supabase.from("moments").update(payload).eq("id", id).select("*").single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, moment })
  } catch (error: any) {
    console.error("Moments PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** Delete a moment — hard-deletes from the database (author or admin). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createServerClient()
    const { data: existing } = await supabase
      .from("moments")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Moment not found" }, { status: 404 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (existing.user_id !== user.id && !profile?.is_admin) {
      return NextResponse.json({ error: "You can only delete your own moments" }, { status: 403 })
    }

    const { error } = await supabase.from("moments").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, message: "Moment deleted" })
  } catch (error: any) {
    console.error("Moments DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
