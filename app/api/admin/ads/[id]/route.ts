import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response
    const { id } = await params
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))

    const allowed = ["sponsor_name", "headline", "description", "media_url", "media_type", "link_url", "is_active"]
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key]
    }
    if (patch.media_url === null || patch.media_url === "") {
      patch.media_url = null
      patch.media_type = null
    }
    if (patch.media_url && !patch.media_type) patch.media_type = "image"
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }
    patch.updated_at = new Date().toISOString()

    const { data: ad, error } = await supabase
      .from("ads")
      .update(patch)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, ad })
  } catch (error: any) {
    console.error("admin ads PATCH:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response
    const { id } = await params
    const supabase = createServerClient()
    const { error } = await supabase.from("ads").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("admin ads DELETE:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
