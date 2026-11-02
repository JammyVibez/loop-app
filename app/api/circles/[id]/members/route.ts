import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { checkCirclePrivateAccess } from "@/lib/circle-access"
import { getUserFromRequest } from "@/lib/server-auth"
import {
  canAssignCircleRole,
  canManageMemberSettings,
  canRemoveCircleMember,
  normalizeRole,
} from "@/lib/circle-permissions"
import { syncCircleMemberCount } from "@/lib/circle-lifecycle"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")

// Get circle members
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const requestedOffset = Number.parseInt(searchParams.get("offset") || "0", 10)
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 50
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.min(100_000, requestedOffset)) : 0
    const role = searchParams.get("role")
    const search = (searchParams.get("search") || "").trim().slice(0, 100)

    const { id: circleId } = await params

    // Private circles: member roster is only visible to approved members/owner.
    const access = await checkCirclePrivateAccess(circleId, request.headers.get("authorization"))
    if (access.isPrivate && !access.canView) {
      return NextResponse.json({ success: true, members: [], hasMore: false, locked: true })
    }

    let query = supabase
      .from("circle_members")
      .select(`
        *,
        user:profiles(id, username, display_name, avatar_url, video_avatar_url, is_verified, is_premium, last_active, loop_coins, level)
      `)
      .eq("circle_id", circleId)
      .in("status", ["active", "approved"])
      .order("joined_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (role) {
      query = query.eq("role", role)
    }

    if (search) {
      query = query.ilike("profiles.display_name", `%${search}%`)
    }

    const { data: members, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      members: members || [],
      hasMore: members?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching circle members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update member role (admin/moderator actions)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: circleId } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { targetUserId, newRole, status, customTitle, permissions } = body as Record<string, unknown>
    if (typeof targetUserId !== "string" || !targetUserId.trim()) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 })
    }
    // Membership transitions have their own join/approval/ban paths. This
    // endpoint must never reactivate a ban or approve a request implicitly.
    if (status !== undefined) {
      return NextResponse.json({ error: "Use the Circle membership workflow to change member status" }, { status: 400 })
    }

    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("owner_id, creator_id")
      .eq("id", circleId)
      .maybeSingle()
    if (circleError) return NextResponse.json({ error: "Could not load Circle" }, { status: 500 })
    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })

    const ownerId = circle.owner_id || circle.creator_id
    let actorRole = ownerId === user.id ? "owner" : null
    if (!actorRole) {
      const { data: actor, error: actorError } = await supabase
        .from("circle_members")
        .select("role, status")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (actorError) return NextResponse.json({ error: "Could not verify Circle permissions" }, { status: 500 })
      if (actor && ["active", "approved"].includes(String(actor.status))) actorRole = actor.role
    }
    const normalizedActor = normalizeRole(actorRole)
    if (normalizedActor !== "owner" && normalizedActor !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { data: target, error: targetError } = await supabase
      .from("circle_members")
      .select("id, role, status")
      .eq("circle_id", circleId)
      .eq("user_id", targetUserId)
      .maybeSingle()
    if (targetError) return NextResponse.json({ error: "Could not load target member" }, { status: 500 })
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 })
    if (!["active", "approved"].includes(String(target.status))) {
      return NextResponse.json({ error: "Only active members can be managed here" }, { status: 409 })
    }

    const updates: Record<string, unknown> = {}
    if (newRole !== undefined) {
      if (typeof newRole !== "string" || !canAssignCircleRole(normalizedActor, target.role, newRole)) {
        return NextResponse.json({ error: "You cannot assign that role to this member" }, { status: 403 })
      }
      updates.role = newRole
    }

    if (customTitle !== undefined || permissions !== undefined) {
      if (!canManageMemberSettings(normalizedActor, target.role)) {
        return NextResponse.json({ error: "You cannot edit settings for this member" }, { status: 403 })
      }
      if (customTitle !== undefined) {
        if (typeof customTitle !== "string" && customTitle !== null) {
          return NextResponse.json({ error: "Custom title must be text" }, { status: 400 })
        }
        updates.custom_title = typeof customTitle === "string" ? customTitle.trim().slice(0, 40) || null : null
      }
      if (permissions !== undefined) {
        if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
          return NextResponse.json({ error: "Permissions must be an object" }, { status: 400 })
        }
        const allowed = [
          "can_manage_events",
          "can_manage_rooms",
          "can_pin_posts",
          "can_moderate",
          "can_post_announcements",
        ]
        const supplied = permissions as Record<string, unknown>
        const sanitized: Record<string, boolean> = {}
        for (const key of allowed) {
          if (key in supplied) {
            if (typeof supplied[key] !== "boolean") {
              return NextResponse.json({ error: "Permission values must be boolean" }, { status: 400 })
            }
            sanitized[key] = supplied[key] as boolean
          }
        }
        if ("can_moderate" in sanitized && normalizedActor !== "owner") {
          return NextResponse.json({ error: "Only the Circle owner can grant moderation permission overrides" }, { status: 403 })
        }
        updates.permissions = sanitized
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const { data: updatedMember, error: updateError } = await supabase
      .from("circle_members")
      .update(updates)
      .eq("id", target.id)
      .eq("status", target.status)
      .select(`
        *,
        user:profiles(id, username, display_name, avatar_url, video_avatar_url)
      `)
      .maybeSingle()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update member role" }, { status: 500 })
    }
    if (!updatedMember) {
      return NextResponse.json({ error: "Member changed. Refresh and try again." }, { status: 409 })
    }

    return NextResponse.json({
      success: true,
      member: updatedMember,
      message: newRole ? `Member role updated to ${newRole}` : "Member updated",
    })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Remove member (kick/ban)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: circleId } = await params
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("userId")
    const action = searchParams.get("action") || "remove"
    if (!targetUserId) return NextResponse.json({ error: "Target user ID is required" }, { status: 400 })
    if (action !== "remove" && action !== "ban") return NextResponse.json({ error: "Action must be remove or ban" }, { status: 400 })
    if (targetUserId === user.id) return NextResponse.json({ error: "You cannot remove or ban yourself through member management" }, { status: 409 })

    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("owner_id, creator_id")
      .eq("id", circleId)
      .maybeSingle()
    if (circleError) return NextResponse.json({ error: "Could not load Circle" }, { status: 500 })
    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })

    const ownerId = circle.owner_id || circle.creator_id
    let actorRole = ownerId === user.id ? "owner" : null
    if (!actorRole) {
      const { data: actor, error: actorError } = await supabase
        .from("circle_members")
        .select("role, status")
        .eq("circle_id", circleId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (actorError) return NextResponse.json({ error: "Could not verify Circle permissions" }, { status: 500 })
      if (actor && ["active", "approved"].includes(String(actor.status))) actorRole = actor.role
    }

    const { data: target, error: targetError } = await supabase
      .from("circle_members")
      .select("id, user_id, role, status")
      .eq("circle_id", circleId)
      .eq("user_id", targetUserId)
      .maybeSingle()
    if (targetError) return NextResponse.json({ error: "Could not load target member" }, { status: 500 })
    if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 })
    if (!canRemoveCircleMember(actorRole, target.role)) {
      return NextResponse.json({ error: "Cannot remove a member with an equal or higher role" }, { status: 403 })
    }
    if (target.status === "banned") {
      return NextResponse.json({ error: "This member is already banned" }, { status: 409 })
    }

    if (action === "ban") {
      const { data: updated, error: banError } = await supabase
        .from("circle_members")
        .update({ status: "banned" })
        .eq("id", target.id)
        .eq("status", target.status)
        .select("id")
        .maybeSingle()
      if (banError) return NextResponse.json({ error: "Failed to ban member" }, { status: 500 })
      if (!updated) return NextResponse.json({ error: "Member changed. Refresh and try again." }, { status: 409 })
    } else {
      const { data: removed, error: removeError } = await supabase
        .from("circle_members")
        .delete()
        .eq("id", target.id)
        .eq("status", target.status)
        .select("id")
        .maybeSingle()
      if (removeError) return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
      if (!removed) return NextResponse.json({ error: "Member changed. Refresh and try again." }, { status: 409 })
    }

    const { syncCircleMemberCount } = await import("@/lib/circle-lifecycle")
    const { error: countError } = await syncCircleMemberCount(supabase, circleId)
    if (countError) {
      console.error("Circle member count sync failed after moderation:", countError)
    }

    try {
      await supabase.channel(`circle-admin:${circleId}`).send({
        type: "broadcast",
        event: "admin_refresh",
        payload: { action, userId: targetUserId },
      })
    } catch {
      /* realtime refresh is best-effort */
    }

    return NextResponse.json({
      success: true,
      message: action === "ban" ? "Member banned successfully" : "Member removed successfully",
    })
  } catch (error) {
    console.error("Error removing Circle member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
