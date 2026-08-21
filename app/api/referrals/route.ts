import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * Lightweight referral dashboard — deliberately reuses the existing
 * profiles.invited_by_username / invited_via_coloop columns (already
 * populated by the Co-Loop invite flow) rather than a new referrals table.
 * Anyone who signed up via /signup?ref=<username> or a Co-Loop invite link
 * shows up here for whoever they were attributed to.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
    if (!profile?.username) {
      return NextResponse.json({ success: true, total: 0, this_week: 0, via_coloop: 0, via_link: 0, referred: [] })
    }

    const { data: referred, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, video_avatar_url, created_at, invited_via_coloop")
      .ilike("invited_by_username", profile.username)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = referred || []
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const thisWeek = rows.filter((r) => new Date(r.created_at).getTime() >= weekAgo).length
    const viaColoop = rows.filter((r) => r.invited_via_coloop).length

    return NextResponse.json({
      success: true,
      total: rows.length,
      this_week: thisWeek,
      via_coloop: viaColoop,
      via_link: rows.length - viaColoop,
      referred: rows,
    })
  } catch (error: any) {
    console.error("Referrals API error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
