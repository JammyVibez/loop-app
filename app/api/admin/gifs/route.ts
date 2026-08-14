import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { data: gifs, error } = await supabase
      .from("curated_gifs")
      .select(`*, added_by:profiles!added_by(id, username, display_name, avatar_url)`)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, gifs: gifs || [] })
  } catch (error: any) {
    console.error("Admin GIFs GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const body = await request.json().catch(() => ({}))
    const title = String(body.title || "").trim()
    const url = String(body.url || "").trim()
    const preview_url = String(body.preview_url || url || "").trim()
    const tags = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean).slice(0, 10) : []
    const source = ["custom", "tenor", "giphy", "uploaded"].includes(body.source) ? body.source : "custom"

    if (!title || !url) {
      return NextResponse.json({ error: "title and url are required" }, { status: 400 })
    }
    if (!/^https?:\/\//.test(url)) {
      return NextResponse.json({ error: "url must be a valid http(s) link" }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: gif, error } = await supabase
      .from("curated_gifs")
      .insert({
        title: title.slice(0, 160),
        url,
        preview_url: preview_url || null,
        tags,
        source,
        added_by: user.id,
        is_active: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, gif }, { status: 201 })
  } catch (error: any) {
    console.error("Admin GIFs POST error:", error)
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
    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim().slice(0, 160)
    if (typeof body.url === "string" && body.url.trim()) updates.url = body.url.trim()
    if (typeof body.preview_url === "string") updates.preview_url = body.preview_url.trim() || null

    const supabase = createServerClient()
    const { data: gif, error } = await supabase
      .from("curated_gifs")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, gif })
  } catch (error: any) {
    console.error("Admin GIFs PATCH error:", error)
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
    const { error } = await supabase.from("curated_gifs").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Admin GIFs DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
