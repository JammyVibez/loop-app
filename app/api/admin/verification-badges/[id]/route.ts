import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const supabase = createServerClient()

    const updates: Record<string, unknown> = {}
    if (typeof body.name === "string") updates.name = body.name.trim()
    if (typeof body.label === "string") updates.label = body.label.trim()
    if (["check", "star", "shield", "crown", "sparkle"].includes(body.icon)) updates.icon = body.icon
    if (Array.isArray(body.colors) && body.colors.length > 0) {
      updates.colors = body.colors.map((c: string) => String(c).trim()).filter(Boolean).slice(0, 2)
    }
    if (typeof body.description === "string") updates.description = body.description.trim()
    if (typeof body.is_active === "boolean") updates.is_active = body.is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data: badge, error } = await supabase
      .from("verification_badges")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, badge })
  } catch (error: any) {
    console.error("PATCH verification badge error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const { id } = await params
    const supabase = createServerClient()

    // Unassign from everyone first (FK is ON DELETE SET NULL, but be explicit).
    await supabase
      .from("profiles")
      .update({ badge_id: null, badge_assigned_at: null })
      .eq("badge_id", id)

    const { error } = await supabase
      .from("verification_badges")
      .delete()
      .eq("id", id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: "Badge deleted" })
  } catch (error: any) {
    console.error("DELETE verification badge error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
