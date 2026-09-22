import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const { user_id, badge_id } = body

    if (!user_id) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

    const supabase = createServerClient()

    // Verify the target profile exists.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, badge_id")
      .eq("id", user_id)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

    if (badge_id) {
      const { data: badge } = await supabase
        .from("verification_badges")
        .select("id, is_active")
        .eq("id", badge_id)
        .maybeSingle()
      if (!badge) return NextResponse.json({ error: "Badge not found" }, { status: 404 })
      if (!badge.is_active) return NextResponse.json({ error: "Badge is deactivated" }, { status: 400 })
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        badge_id: badge_id || null,
        badge_assigned_at: badge_id ? new Date().toISOString() : null,
      })
      .eq("id", user_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Notify the user about their new checkmark.
    if (badge_id) {
      try {
        await supabase.from("notifications").insert({
          user_id,
          type: "verification_badge",
          title: "New checkmark! 🎖️",
          // Platform voice — never expose that staff granted it manually.
          message: `You've been awarded the "${badge_id}" checkmark. It now shows next to your name across Loop.`,
          data: { badge_id },
        })
      } catch {
        // best-effort notification
      }
    }

    return NextResponse.json({
      success: true,
      message: badge_id ? "Checkmark assigned" : "Checkmark removed",
    })
  } catch (error: any) {
    console.error("Assign verification badge error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
