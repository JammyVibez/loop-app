import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUser(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") || null
  if (!token) return null
  const supabase = createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

async function getMember(circleId: string, userId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from("circle_members")
    .select("role, status")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle()
  return data
}

function canManage(role?: string) {
  return role === "owner" || role === "admin" || role === "moderator"
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerClient()
  const { data: circle, error } = await supabase.from("circles").select("id, settings, theme_id").eq("id", id).single()
  if (error) return NextResponse.json({ error: "Circle not found" }, { status: 404 })
  return NextResponse.json({ success: true, studio: circle?.settings?.community_studio || {}, theme_id: circle?.theme_id || null })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const member = await getMember(id, user.id)
  if (!canManage(member?.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
  const body = await request.json()
  const supabase = createServerClient()
  const { data: current } = await supabase.from("circles").select("settings").eq("id", id).single()
  const settings = { ...(current?.settings || {}), community_studio: { ...(current?.settings?.community_studio || {}), ...(body.studio || body) } }
  const { data: circle, error } = await supabase.from("circles").update({ settings, theme_id: body.theme_id || undefined, updated_at: new Date().toISOString() }).eq("id", id).select("id, settings, theme_id").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, studio: circle.settings?.community_studio || {}, theme_id: circle.theme_id || null })
}
