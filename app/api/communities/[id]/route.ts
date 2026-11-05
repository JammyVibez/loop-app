import { type NextRequest, NextResponse } from "next/server"
import { communityClient, getWorldBundle, logCommunityActivity, canAdmin } from "@/lib/community-engine"
import { resolveStaffRole } from "@/lib/staff-roles"
import { hardDeleteCircle } from "@/lib/circle-lifecycle"
import { getUserFromRequest } from "@/lib/server-auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    const sb = communityClient()

    // Private community check
    const { data: circle } = await sb.from("circles").select("id, is_private, is_premium_only").eq("id", id).maybeSingle()
    if (!circle) return NextResponse.json({ error: "Community not found" }, { status: 404 })

    let canView = !circle.is_private
    if (circle.is_private && user) {
      const { data: member } = await sb
        .from("circle_members")
        .select("status")
        .eq("circle_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
      canView = member?.status === "active" || member?.status === "approved"
    }

    if (!canView) {
      return NextResponse.json({ error: "This community is private", locked: true }, { status: 403 })
    }

    const bundle = await getWorldBundle(sb, id, user?.id || null)
    if (!bundle) return NextResponse.json({ error: "Community not found" }, { status: 404 })

    // Moderators see how many posts are waiting in the approval queue.
    let pendingPostCount = 0
    if (user && (bundle.is_moderator || bundle.is_admin)) {
      const { count } = await sb
        .from("circle_posts")
        .select("id", { count: "exact", head: true })
        .eq("circle_id", id)
        .eq("status", "pending")
      pendingPostCount = count || 0
    }

    return NextResponse.json({ ...bundle, pending_post_count: pendingPostCount })
  } catch (e: any) {
    console.error("[communities/id] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load community" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const { data: membership } = await sb
      .from("circle_members")
      .select("role")
      .eq("circle_id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!canAdmin(membership?.role)) {
      return NextResponse.json({ error: "Only owners and admins can edit this community" }, { status: 403 })
    }

    const body = await request.json()
    const allowed: Record<string, any> = {}
    const editable = [
      "name", "description", "category", "tags", "is_private", "is_public", "rules",
      "avatar_url", "banner_url", "cover_url", "accent_color", "layout_preset",
      "featured_modules", "enabled_features", "custom_roles", "recognition_rules",
      "moderation_settings", "discovery_preferences", "welcome_message", "handle",
    ]
    for (const key of editable) {
      if (body[key] !== undefined) allowed[key] = body[key]
    }
    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    if (allowed.handle) {
      const normalized = String(allowed.handle).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40)
      const { data: clash } = await sb.from("circles").select("id").eq("handle", normalized).neq("id", id).maybeSingle()
      if (clash) return NextResponse.json({ error: "That handle is already taken" }, { status: 409 })
      allowed.handle = normalized
    }

    allowed.updated_at = new Date().toISOString()

    const { data: updated, error } = await sb.from("circles").update(allowed).eq("id", id).select().single()
    if (error || !updated) {
      return NextResponse.json({ error: "Failed to update: " + (error?.message || "") }, { status: 500 })
    }

    await logCommunityActivity(sb, id, user.id, "community_updated", "circle", id, { fields: Object.keys(allowed) })
    return NextResponse.json({ community: updated })
  } catch (e: any) {
    console.error("[communities/id] PATCH error:", e)
    return NextResponse.json({ error: e.message || "Failed to update" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    // Owner or community admin can delete it; site admins (the platform's own
    // moderators) can too, so a reported community never has to wait on its
    // founder to answer.
    const [{ data: membership }, { data: profile }] = await Promise.all([
      sb.from("circle_members").select("role").eq("circle_id", id).eq("user_id", user.id).maybeSingle(),
      sb.from("profiles").select("is_admin, is_moderator, staff_role").eq("id", user.id).maybeSingle(),
    ])
    const staffRole = resolveStaffRole(profile)
    if (!canAdmin(membership?.role) && staffRole !== "developer" && staffRole !== "admin") {
      return NextResponse.json({ error: "Only the owner or an admin can delete this community" }, { status: 403 })
    }

    // Related rows first: a bare delete on `circles` fails outright as soon as
    // the community has threads, members or roles.
    const { error } = await hardDeleteCircle(sb, id)
    if (error) return NextResponse.json({ error: "Failed to delete: " + error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("[communities/id] DELETE error:", e)
    return NextResponse.json({ error: e.message || "Failed to delete" }, { status: 500 })
  }
}