import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const supabase = createServerClient()
    const { data: badges, error } = await supabase
      .from("verification_badges")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, badges: badges || [] })
  } catch (error: any) {
    console.error("GET verification badges error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request)
  if (response) return response

  try {
    const body = await request.json().catch(() => ({}))
    const name = String(body.name || "").trim()
    const label = String(body.label || "").trim()
    const icon = ["check", "star", "shield", "crown", "sparkle"].includes(body.icon)
      ? body.icon
      : "check"
    const colors: string[] = Array.isArray(body.colors)
      ? body.colors.map((c: string) => String(c).trim()).filter(Boolean).slice(0, 2)
      : ["#0ea5e9"]

    if (!name) return NextResponse.json({ error: "Badge name is required" }, { status: 400 })
    if (colors.length === 0) return NextResponse.json({ error: "At least one color is required" }, { status: 400 })

    const supabase = createServerClient()
    const id = `badge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    const { data: badge, error } = await supabase
      .from("verification_badges")
      .insert({
        id,
        name,
        label: label || null,
        icon,
        colors,
        description: body.description ? String(body.description).trim() : null,
        is_active: body.is_active !== false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, badge })
  } catch (error: any) {
    console.error("POST verification badge error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
