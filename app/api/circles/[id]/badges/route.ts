import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

/** GET /api/circles/[id]/badges — list circle badges and member progress */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: circleId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("user_id")

    const supabase = createServerClient()

    // Get badges
    const { data: badges, error: badgeError } = await supabase
      .from("circle_badges")
      .select("*")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: true })

    if (badgeError) {
      return NextResponse.json({ error: badgeError.message }, { status: 500 })
    }

    // If user_id provided, also get their earned badges
    let memberStats = null
    if (userId) {
      const { data: stats } = await supabase
        .from("circle_member_stats")
        .select("*")
        .eq("circle_id", circleId)
        .eq("user_id", userId)
        .maybeSingle()
      memberStats = stats
    }

    return NextResponse.json({
      success: true,
      badges: badges || [],
      member_stats: memberStats,
      earned_badges: memberStats?.earned_badges || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

/** POST /api/circles/[id]/badges — create a badge (owner/admin only) */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: circleId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Check membership
    const { data: member } = await supabase
      .from("circle_members")
      .select("role")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: "Only circle owners and admins can create badges" }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, icon, color, requirement_type, requirement_value, rarity } = body

    if (!name || !requirement_type) {
      return NextResponse.json({ error: "name and requirement_type are required" }, { status: 400 })
    }

    const { data: badge, error } = await supabase
      .from("circle_badges")
      .insert({
        circle_id: circleId,
        name,
        description: description || "",
        icon: icon || "⭐",
        color: color || "amber",
        requirement_type,
        requirement_value: requirement_value || 1,
        rarity: rarity || "common",
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, badge })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
