import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity, canModerate, canAdmin } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"
import { SPACE_TYPES } from "@/lib/community-categories"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    const sb = communityClient()

    const { data: circle } = await sb.from("circles").select("is_private").eq("id", id).maybeSingle()
    if (!circle) return NextResponse.json({ error: "Community not found" }, { status: 404 })

    let canView = !circle.is_private
    if (circle.is_private && user) {
      const { data: member } = await sb.from("circle_members").select("status").eq("circle_id", id).eq("user_id", user.id).maybeSingle()
      canView = member?.status === "active" || member?.status === "approved"
    }
    if (!canView) return NextResponse.json({ error: "Private community" }, { status: 403 })

    const { data: spaces, error } = await sb
      .from("community_spaces")
      .select("*")
      .eq("circle_id", id)
      .eq("is_archived", false)
      .order("sort_order")
      .limit(60)
    if (error) return NextResponse.json({ error: "Failed to load spaces" }, { status: 500 })
    return NextResponse.json({ spaces: spaces || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to load spaces" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to manage spaces" }, { status: 401 })
    const sb = communityClient()

    const { data: membership } = await sb.from("circle_members").select("role").eq("circle_id", id).eq("user_id", user.id).maybeSingle()
    if (!canModerate(membership?.role)) {
      return NextResponse.json({ error: "Only moderators and above can create spaces" }, { status: 403 })
    }

    const body = await request.json()
    const { name, type = "discussion", icon, description = "", visibility = "members", permissions = {}, content_rules = {} } = body

    if (!name || !name.trim()) return NextResponse.json({ error: "Space needs a name" }, { status: 400 })
    const validType = SPACE_TYPES.some((t) => t.id === type) ? type : "discussion"

    const { count } = await sb.from("community_spaces").select("id", { count: "exact", head: true }).eq("circle_id", id)
    const { data: space, error } = await sb
      .from("community_spaces")
      .insert({
        circle_id: id,
        name: name.trim().slice(0, 60),
        slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        type: validType,
        icon: icon || "hash",
        description: description.slice(0, 300),
        visibility,
        permissions: permissions || {},
        content_rules: content_rules || {},
        sort_order: count || 0,
        created_by: user.id,
      })
      .select()
      .single()

    if (error || !space) {
      return NextResponse.json({ error: "Failed to create space: " + (error?.message || "") }, { status: 500 })
    }

    await logCommunityActivity(sb, id, user.id, "space_created", "space", space.id, { name: space.name, type: space.type })
    return NextResponse.json({ space }, { status: 201 })
  } catch (e: any) {
    console.error("[spaces] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to create space" }, { status: 500 })
  }
}