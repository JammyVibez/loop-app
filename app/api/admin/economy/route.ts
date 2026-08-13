import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getEconomySettings, normalizeEconomySettings, saveEconomySettings } from "@/lib/economy"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response
    const supabase = createServerClient()
    const economy = await getEconomySettings(supabase)
    return NextResponse.json({ success: true, economy })
  } catch (error: any) {
    console.error("admin economy GET:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response
    const supabase = createServerClient()

    const body = await request.json().catch(() => ({}))
    const patch = body.economy || body.settings || body
    const economy = await saveEconomySettings(
      supabase,
      normalizeEconomySettings({ ...(await getEconomySettings(supabase)), ...patch }),
      user.id,
    )

    return NextResponse.json({
      success: true,
      economy,
      message: "Economy settings saved",
    })
  } catch (error: any) {
    console.error("admin economy POST:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
