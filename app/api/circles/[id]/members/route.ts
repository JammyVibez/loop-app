import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { checkCirclePrivateAccess } from "@/lib/circle-access"
import { getUserFromRequest } from "@/lib/server-auth"
import {
  canAssignCircleRole,
  canManageMemberSettings,
  normalizeRole,
} from "@/lib/circle-permissions"

function getCircleMembersClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createServerClient()
}

// Get circle members
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = getCircleMembersClient()
    if (!supabase) return NextResponse.json({ error: "Circle member service is unavailable" }, { status: 503 })

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
        id, circle_id, user_id, role, status, custom_title, permissions, joined_at,
        user:profiles(id, username, display_name, avatar_url, video_avatar_url, is_verified)
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
    const supabase = getCircleMembersClient()
    if (!supabase) return NextResponse.json({ error: "Circle member service is unavailable" }, { status: 503 })

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
      .select("owner_id")
      .eq("id", circleId)
      .maybeSingle()
    if (circleError) return NextResponse.json({ error: "Could not load Circle" }, { status: 500 })
    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })

    const ownerId = circle.owner_id
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

    const supabase = getCircleMembersClient()
    if (!supabase) return NextResponse.json({ error: "Circle member service is unavailable" }, { status: 503 })

    const { id: circleId } = await params
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get("userId")
    const action = searchParams.get("action") || "remove"
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (!uuidPattern.test(circleId) || !targetUserId || !uuidPattern.test(targetUserId)) {
      return NextResponse.json({ error: "A valid Circle and target user ID are required" }, { status: 400 })
    }
    if (action !== "remove" && action !== "ban") {
      return NextResponse.json({ error: "Action must be remove or ban" }, { status: 400 })
    }
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Use the leave Circle action to remove yourself" }, { status: 409 })
    }

    // The RPC locks the Circle row, rechecks current actor/target roles and
    // changes membership + member_count together with join/approval traffic.
    const { data, error } = await supabase.rpc("manage_circle_member", {
      p_circle_id: circleId,
      p_actor_id: user.id,
      p_target_user_id: targetUserId,
      p_action: action,
    })

    if (error) {
      console.error("Atomic Circle member moderation failed:", error)
      if (error.code === "42501") return NextResponse.json({ error: error.message || "Insufficient Circle permissions" }, { status: 403 })
      if (error.code === "P0002") return NextResponse.json({ error: "Circle or member not found" }, { status: 404 })
      if (error.code === "55000") return NextResponse.json({ error: error.message || "Membership has already changed" }, { status: 409 })
      if (error.code === "22023") return NextResponse.json({ error: error.message || "Invalid membership action" }, { status: 409 })
      if (["42883", "42P01", "42703"].includes(error.code || "")) {
        return NextResponse.json({ error: "Atomic Circle moderation is unavailable until the database migration is applied." }, { status: 503 })
      }
      return NextResponse.json({ error: "Could not update Circle membership" }, { status: 500 })
    }

    const result = (Array.isArray(data) ? data[0] : data) as {
      circle_id?: string
      user_id?: string
      status?: string
      member_count?: number
    } | null
    if (result?.circle_id !== circleId || result.user_id !== targetUserId || !["banned", "removed"].includes(result.status || "")) {
      return NextResponse.json({ error: "Circle moderation returned an invalid result" }, { status: 500 })
    }

    try {
      await supabase.channel(`circle-admin:${circleId}`).send({
        type: "broadcast",
        event: "admin_refresh",
        payload: { action, userId: targetUserId },
      })
    } catch {
      /* realtime refresh is best-effort; the database result is canonical */
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      member_count: result.member_count,
      message: action === "ban" ? "Member banned successfully" : "Member removed successfully",
    })
  } catch (error) {
    console.error("Error removing Circle member:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
