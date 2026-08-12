import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/admin/settings - Get all admin settings
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { data: settings, error } = await supabase.from("admin_settings").select("*")

    if (error) {
      throw error
    }

    const settingsObject: Record<string, any> = {}
    ;(settings || []).forEach((setting) => {
      settingsObject[setting.setting_key] = setting.setting_value
    })

    return NextResponse.json({ success: true, data: settingsObject })
  } catch (error) {
    console.error("Error fetching admin settings:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/settings - Create or update admin settings
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ success: false, error: "Settings data is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Upsert so a brand-new setting_key (e.g. one introduced by a new admin
    // panel) can be saved without needing a pre-seeded row first.
    const rows = Object.entries(settings).map(([key, value]) => ({
      setting_key: key,
      setting_value: value,
      updated_by: user!.id,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from("admin_settings").upsert(rows, { onConflict: "setting_key" })

    if (error) {
      console.error("Error updating settings:", error)
      return NextResponse.json({ success: false, error: error.message || "Failed to update settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Settings updated successfully" })
  } catch (error) {
    console.error("Error updating admin settings:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
