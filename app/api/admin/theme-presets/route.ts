import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { validateThemeConfig } from "@/lib/circle-themes"

function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase configuration")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const supabase = createServerClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { user, supabase }
}

/** GET — List all active presets */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get("all") === "true"
    const supabase = createServerClient()

    let query = supabase
      .from("circle_theme_presets")
      .select("*")
      .order("sort_order", { ascending: true })

    if (!all) query = query.eq("is_active", true)

    const { data: presets, error } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch presets" }, { status: 500 })
    }

    return NextResponse.json({ success: true, presets: presets || [] })
  } catch (error) {
    console.error("Error fetching presets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST — Create a new preset (admin only) */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ("error" in auth) return auth.error
    const { supabase } = auth

    const body = await request.json()
    const { name, description, theme_config, preview_url } = body

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Preset name is required (min 2 chars)" }, { status: 400 })
    }
    if (!theme_config) {
      return NextResponse.json({ error: "theme_config is required" }, { status: 400 })
    }

    const validatedConfig = validateThemeConfig(theme_config)

    // Get next sort_order
    const { data: last } = await supabase
      .from("circle_theme_presets")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (last?.sort_order ?? 0) + 1

    const { data: preset, error } = await supabase
      .from("circle_theme_presets")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        theme_config: validatedConfig,
        preview_url: preview_url || null,
        is_system: false,
        is_active: true,
        created_by: auth.user!.id,
        sort_order: nextOrder,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, preset })
  } catch (error) {
    console.error("Error creating preset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** PUT — Update an existing preset (admin only) */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ("error" in auth) return auth.error
    const { supabase } = auth

    const body = await request.json()
    const { id, name, description, theme_config, preview_url, is_active, sort_order } = body

    if (!id) return NextResponse.json({ error: "Preset id is required" }, { status: 400 })

    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = name.trim()
    if (description !== undefined) update.description = description?.trim() || null
    if (theme_config !== undefined) update.theme_config = validateThemeConfig(theme_config)
    if (preview_url !== undefined) update.preview_url = preview_url
    if (is_active !== undefined) update.is_active = is_active
    if (sort_order !== undefined) update.sort_order = sort_order

    const { data: preset, error } = await supabase
      .from("circle_theme_presets")
      .update(update)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, preset })
  } catch (error) {
    console.error("Error updating preset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE — Soft-delete a preset (admin only, system presets can be deactivated) */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ("error" in auth) return auth.error
    const { supabase } = auth

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Preset id is required" }, { status: 400 })

    const { error } = await supabase
      .from("circle_theme_presets")
      .update({ is_active: false })
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: "Preset deactivated" })
  } catch (error) {
    console.error("Error deleting preset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
