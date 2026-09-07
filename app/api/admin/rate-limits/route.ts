import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import {
  getRateLimitSettings,
  normalizeRateLimitSettings,
  refreshRateLimitSettings,
  saveRateLimitSettings,
} from "@/lib/rate-limit-settings"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response
    const supabase = createServerClient()
    const settings = await getRateLimitSettings(supabase)
    return NextResponse.json({ success: true, settings })
  } catch (error: any) {
    console.error("admin rate-limits GET:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response
    const supabase = createServerClient()

    const body = await request.json().catch(() => ({}))
    const patch = body.settings || body
    const settings = await saveRateLimitSettings(
      supabase,
      normalizeRateLimitSettings({
        ...(await getRateLimitSettings(supabase)),
        ...patch,
      }),
    )
    // Make sure the next request sees the new values immediately.
    await refreshRateLimitSettings(supabase)

    return NextResponse.json({
      success: true,
      settings,
      message: `Rate limiting ${settings.enabled ? "enabled" : "disabled"}`,
    })
  } catch (error: any) {
    console.error("admin rate-limits POST:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
