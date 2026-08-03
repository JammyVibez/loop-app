import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session_id = searchParams.get("session") || searchParams.get("id")
    const invited_by = searchParams.get("invitedBy") || searchParams.get("inviter")

    const supabase = createServerClient()

    let inviterProfile = null
    if (invited_by) {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, is_verified")
        .eq("username", invited_by.toLowerCase().trim())
        .maybeSingle()
      inviterProfile = data
    }

    // Attempt to locate notifications or messages for this session to get title/inviter if not found
    if (!inviterProfile && session_id) {
      const { data: notif } = await supabase
        .from("notifications")
        .select("data")
        .eq("type", "co_loop_invite")
        .filter("data->>session_id", "eq", session_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (notif?.data?.inviter_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio, is_verified")
          .eq("id", notif.data.inviter_id)
          .single()
        inviterProfile = p
      }
    }

    return NextResponse.json({
      success: true,
      session_id,
      inviter: inviterProfile || {
        username: invited_by || "a collaborator",
        display_name: invited_by || "A Creator on Loop",
        avatar_url: null,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
