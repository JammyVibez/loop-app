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
  const { data: bots, error } = await supabase.from("circle_bots").select("*").eq("circle_id", id).order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, bots: bots || [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const member = await getMember(id, user.id)
  if (!canManage(member?.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })

  const body = await request.json()
  const supabase = createServerClient()
  const { data: bot, error } = await supabase.from("circle_bots").upsert({
    id: body.id,
    circle_id: id,
    name: body.name || "Loop Bot",
    bot_type: body.bot_type || "welcome",
    enabled: body.enabled ?? true,
    configuration: body.configuration || {},
    updated_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, bot })
}
