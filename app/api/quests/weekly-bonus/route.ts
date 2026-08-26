import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getEconomySettings } from "@/lib/economy"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

/**
 * Legacy weekly endpoint — disabled in favor of /api/quests/daily-checkin
 * so free coins cannot be double-claimed.
 */
export async function POST(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })

    const economy = await getEconomySettings(supabase)
    if (!economy.weekly_claim_enabled) {
      return NextResponse.json(
        { error: "Weekly claims are turned off by admin", disabled: true },
        { status: 403 },
      )
    }

    return NextResponse.json(
      {
        error: "This endpoint is retired. Use Daily Pulse /api/quests/daily-checkin with kind=weekly.",
        redirect: "/api/quests/daily-checkin",
      },
      { status: 410 },
    )
  } catch (error) {
    console.error("Legacy weekly bonus error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
