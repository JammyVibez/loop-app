import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { data: emojis, error } = await supabase
      .from("curated_emojis")
      .select("*, added_by:profiles!added_by(id, username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, emojis: emojis || [] })
  } catch (error: any) {
    console.error("Admin Emojis GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const shortcode = String(body.shortcode || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")
    const url = String(body.url || "").trim()
    const preview_url = String(body.preview_url || url || "").trim()
    const category = String(body.category || "custom").trim()

    if (!shortcode || !url) {
      return NextResponse.json({ error: "shortcode and url are required" }, { status: 400 })
    }
    if (shortcode.length < 2 || shortcode.length > 32) {
      return NextResponse.json({ error: "shortcode must be 2-32 characters" }, { status: 400 })
    }
    if (!/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: "url must be a valid http(s) link" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Check for duplicate shortcode
    const { data: existing } = await supabase
      .from("curated_emojis")
      .select("id")
      .eq("shortcode", shortcode)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: `Emoji :${shortcode}: already exists` }, { status: 409 })
    }

    const { data: emoji, error } = await supabase
      .from("curated_emojis")
      .insert({
        shortcode,
        url,
        preview_url: preview_url || null,
        category: category.slice(0, 64),
        added_by: user.id,
        is_active: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, emoji }, { status: 201 })
  } catch (error: any) {
    console.error("Admin Emojis POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const id = String(body.id || "")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const updates: Record<string, any> = {}
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active
    if (typeof body.category === "string" && body.category.trim()) updates.category = body.category.trim().slice(0, 64)
    if (typeof body.url === "string" && body.url.trim()) updates.url = body.url.trim()
    if (typeof body.preview_url === "string") updates.preview_url = body.preview_url.trim() || null
    updates.updated_at = new Date().toISOString()

    const supabase = createServerClient()
    const { data: emoji, error } = await supabase
      .from("curated_emojis")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, emoji })
  } catch (error: any) {
    console.error("Admin Emojis PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const id = request.nextUrl.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const supabase = createServerClient()
    const { error } = await supabase.from("curated_emojis").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Admin Emojis DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
