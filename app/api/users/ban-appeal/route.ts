import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireUser } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/users/ban-appeal — current user's appeal status (if any)
export async function GET(request: NextRequest) {
  const { user, response } = await requireUser(request)
  if (response) return response

  const supabase = createServerClient()
  const { data: appeal } = await supabase
    .from("ban_appeals")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json({ success: true, appeal: appeal || null })
}

// POST /api/users/ban-appeal — submit an appeal (only while suspended)
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUser(request)
    if (response) return response

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned, is_deleted")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.is_deleted) {
      return NextResponse.json({ error: "Deleted accounts cannot appeal" }, { status: 400 })
    }
    if (!profile?.is_banned) {
      return NextResponse.json({ error: "Your account is not suspended" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = String(body.reason || "").trim()
    if (!reason) {
      return NextResponse.json({ error: "Appeal reason is required" }, { status: 400 })
    }
    if (reason.length > 2000) {
      return NextResponse.json({ error: "Appeal reason is too long (max 2000 chars)" }, { status: 400 })
    }

    const { data: appeal, error } = await supabase
      .from("ban_appeals")
      .upsert(
        {
          user_id: user.id,
          reason,
          status: "pending",
          admin_notes: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, appeal })
  } catch (error) {
    console.error("Ban appeal error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
