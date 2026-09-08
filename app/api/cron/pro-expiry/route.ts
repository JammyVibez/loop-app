import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 55

// Pro-expiry auto-removal. Runs daily (see vercel.json crons) and can also
// be invoked manually:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://loopapp.me/api/cron/pro-expiry
// Flips is_premium → false for any profile whose premium_expires_at has
// passed, so stale PRO badges/pro perks disappear exactly when a
// subscription lapses instead of lingering forever.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")?.replace("Bearer ", "") || ""
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServerClient()
    const now = new Date().toISOString()

    const { data: lapsed, error } = await supabase
      .from("profiles")
      .update({ is_premium: false, updated_at: now })
      .eq("is_premium", true)
      .lt("premium_expires_at", now)
      .select("id")

    if (error) {
      console.error("pro-expiry cleanup error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const removedIds = (lapsed || []).map((row) => row.id)
    if (removedIds.length > 0) {
      console.log(`Pro expiry: removed PRO from ${removedIds.length} lapsed subscribers`)
    }

    return NextResponse.json({ success: true, removed: removedIds.length, ids: removedIds })
  } catch (error) {
    console.error("pro-expiry cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}