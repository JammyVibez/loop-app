import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const DEFAULTS: Record<string, unknown> = {
  maintenance_mode: {
    enabled: false,
    message: "We are performing scheduled maintenance. Please check back soon.",
    developer_notes: "",
  },
  app_logo: {
    logo_url: "/icons/icon.svg",
  },
  user_registration: {
    enabled: true,
    require_email_verification: false,
  },
  pro_lounge: {
    open: true,
    announcement: "",
  },
  shop_under_construction: {
    enabled: true,
    message: "We're building something amazing!",
    subtitle: "Our shop is being redesigned with new features and items. Check back soon or chat with support.",
  },
}

/** GET — public read of maintenance + logo; full read for admins (backward-compatible `data` shape). */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { data: rows } = await supabase
      .from("admin_settings")
      .select("setting_key, setting_value, updated_at")

    const all: Record<string, unknown> = {}
    for (const row of rows || []) all[row.setting_key] = row.setting_value

    // Merge defaults so old consumers always see the keys they expect.
    const merged: Record<string, unknown> = {}
    for (const key of Object.keys(DEFAULTS)) {
      merged[key] = { ...(DEFAULTS[key] as object), ...((all[key] as object) || {}) }
    }
    for (const key of Object.keys(all)) {
      if (!(key in DEFAULTS)) merged[key] = all[key]
    }

    return NextResponse.json({
      success: true,
      settings: merged,
      data: merged,
    })
  } catch (error: any) {
    console.error("Admin settings GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** PUT / POST — admin only. Accepts { maintenance_mode?, app_logo?, user_registration?, pro_lounge? }
 *  or the legacy { settings: { ... } } body shape. */
export async function PUT(request: NextRequest) {
  return handleUpsert(request)
}

export async function POST(request: NextRequest) {
  return handleUpsert(request)
}

async function handleUpsert(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, is_admin")
      .eq("id", user.id)
      .maybeSingle()
    if (!profile?.is_admin) return NextResponse.json({ error: "Admin only" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    // Legacy shape: { settings: { maintenance_mode: {...} } }
    const payload = body.settings && typeof body.settings === "object" ? body.settings : body

    const updates: Array<{ key: string; value: unknown }> = []

    if (payload.maintenance_mode !== undefined) {
      const mm = payload.maintenance_mode
      if (typeof mm.enabled !== "boolean") {
        return NextResponse.json({ error: "maintenance_mode.enabled must be a boolean" }, { status: 400 })
      }
      updates.push({
        key: "maintenance_mode",
        value: {
          enabled: mm.enabled,
          message: String(mm.message ?? "We are performing scheduled maintenance. Please check back soon.").slice(0, 500),
          developer_notes: String(mm.developer_notes ?? "").slice(0, 1000),
        },
      })
    }
    if (payload.app_logo !== undefined) {
      const logo = payload.app_logo
      if (!logo.logo_url || typeof logo.logo_url !== "string") {
        return NextResponse.json({ error: "app_logo.logo_url is required" }, { status: 400 })
      }
      updates.push({ key: "app_logo", value: { logo_url: String(logo.logo_url).slice(0, 1000) } })
    }
    if (payload.user_registration !== undefined) {
      const ur = payload.user_registration
      updates.push({
        key: "user_registration",
        value: {
          enabled: Boolean(ur.enabled ?? true),
          require_email_verification: Boolean(ur.require_email_verification ?? false),
        },
      })
    }
    if (payload.pro_lounge !== undefined) {
      updates.push({ key: "pro_lounge", value: payload.pro_lounge })
    }

    // Persist any unknown keys too (forward-compatible with other admin panels).
    for (const key of Object.keys(payload)) {
      if (!["maintenance_mode", "app_logo", "user_registration", "pro_lounge"].includes(key)) {
        updates.push({ key, value: payload[key] })
      }
    }

    if (updates.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    for (const update of updates) {
      const { error } = await supabase.from("admin_settings").upsert(
        {
          setting_key: update.key,
          setting_value: update.value,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "setting_key" },
      )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Admin settings upsert error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
