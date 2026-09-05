import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity, canModerate } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; spaceId: string }> }) {
  try {
    const { id, spaceId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const { data: membership } = await sb.from("circle_members").select("role").eq("circle_id", id).eq("user_id", user.id).maybeSingle()
    if (!canModerate(membership?.role)) {
      return NextResponse.json({ error: "Only moderators and above can edit spaces" }, { status: 403 })
    }

    const body = await request.json()
    const allowed: Record<string, any> = {}
    for (const key of ["name", "type", "icon", "description", "visibility", "permissions", "content_rules", "pinned_content", "is_archived", "sort_order"]) {
      if (body[key] !== undefined) allowed[key] = body[key]
    }
    if (allowed.name) allowed.name = String(allowed.name).slice(0, 60)
    allowed.updated_at = new Date().toISOString()

    const { data: space, error } = await sb.from("community_spaces").update(allowed).eq("id", spaceId).eq("circle_id", id).select().single()
    if (error || !space) {
      return NextResponse.json({ error: "Failed to update space" }, { status: 500 })
    }

    await logCommunityActivity(sb, id, user.id, "space_updated", "space", spaceId, {
      name: space.name,
      archived: Boolean(allowed.is_archived),
    })
    return NextResponse.json({ space })
  } catch (e: any) {
    console.error("[space] PATCH error:", e)
    return NextResponse.json({ error: e.message || "Failed to update space" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; spaceId: string }> }) {
  try {
    const { id, spaceId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const { data: membership } = await sb.from("circle_members").select("role").eq("circle_id", id).eq("user_id", user.id).maybeSingle()
    if (!canModerate(membership?.role)) {
      return NextResponse.json({ error: "Only moderators and above can delete spaces" }, { status: 403 })
    }

    const { data: space } = await sb.from("community_spaces").select("name").eq("id", spaceId).eq("circle_id", id).maybeSingle()
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 })

    // Move posts back to General before deleting
    await sb.from("circle_posts").update({ space_id: null }).eq("space_id", spaceId)
    const { error } = await sb.from("community_spaces").delete().eq("id", spaceId).eq("circle_id", id)
    if (error) return NextResponse.json({ error: "Failed to delete space" }, { status: 500 })

    await logCommunityActivity(sb, id, user.id, "space_deleted", "space", spaceId, { name: space.name })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[space] DELETE error:", e)
    return NextResponse.json({ error: e.message || "Failed to delete space" }, { status: 500 })
  }
}