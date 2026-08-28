import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

/** GET /api/circles/[id]/activity — fetch circle activity feed */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: circleId } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")))
    const offset = Math.max(0, Number(searchParams.get("offset") || "0"))

    const supabase = createServerClient()
    const { data: activities, error } = await supabase
      .from("circle_activity")
      .select(`
        *,
        actor:profiles!actor_id(id, username, display_name, avatar_url, video_avatar_url, is_premium, is_verified, level)
      `)
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, activities: activities || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

/** POST /api/circles/[id]/activity — log a circle activity event */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: circleId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { activity_type, target_type, target_id, metadata } = body

    if (!activity_type) {
      return NextResponse.json({ error: "activity_type is required" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { error } = await supabase.from("circle_activity").insert({
      circle_id: circleId,
      actor_id: user.id,
      activity_type,
      target_type: target_type || null,
      target_id: target_id || null,
      metadata: metadata || {},
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
