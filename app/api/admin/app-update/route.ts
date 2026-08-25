import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

// GET /api/admin/app-update - Get current app update mode status
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { data: setting, error } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "app_update_mode")
      .maybeSingle()

    if (error) {
      console.error("Error fetching app update mode:", error)
      return NextResponse.json({ success: false, error: "Failed to fetch app update mode" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: setting?.setting_value || { enabled: false, message: "App is currently updating" },
    })
  } catch (error) {
    console.error("Error fetching app update mode:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/app-update - Update app update mode status
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const { enabled, message, version, update_notes } = await request.json()

    const supabase = createServerClient()
    const now = new Date().toISOString()
    const { data: existing } = await supabase
      .from("admin_settings")
      .select("setting_key")
      .eq("setting_key", "app_update_mode")
      .maybeSingle()

    let data
    if (existing) {
      const { data: updated } = await supabase
        .from("admin_settings")
        .update({ setting_value: { enabled, message, version, update_notes }, updated_by: user!.id, updated_at: now })
        .eq("setting_key", "app_update_mode")
        .select()
        .maybeSingle()
      data = updated
    } else {
      const { data: inserted } = await supabase
        .from("admin_settings")
        .insert({ setting_key: "app_update_mode", setting_value: { enabled, message, version, update_notes }, updated_by: user!.id, updated_at: now })
        .select()
        .maybeSingle()
      data = inserted
    }

    return NextResponse.json({ success: true, data, message: "App update mode updated successfully" })
  } catch (error) {
    console.error("Error updating app update mode:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
