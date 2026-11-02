import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { notifyUser } from "@/lib/notifications";
import { getUserFromRequest } from "@/lib/server-auth"
import { canApproveCircleRole, normalizeRole } from "@/lib/circle-permissions"
import { syncCircleMemberCount } from "@/lib/circle-lifecycle";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")

async function getCircleStaffRole(circleId: string, userId: string): Promise<"owner" | "admin" | "moderator" | null> {
  const { data: circle, error: circleError } = await supabase
    .from("circles")
    .select("owner_id, creator_id")
    .eq("id", circleId)
    .maybeSingle()
  if (circleError || !circle) return null
  if ((circle.owner_id || circle.creator_id) === userId) return "owner"

  const { data: member, error } = await supabase
    .from("circle_members")
    .select("role, status")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !member || !["active", "approved"].includes(String(member.status))) return null
  const role = normalizeRole(member.role)
  return role === "owner" || role === "admin" || role === "moderator" ? role : null
}

// Get pending join requests
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId } = await params

    if (!(await getCircleStaffRole(circleId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get pending members
    const { data: pendingMembers, error } = await supabase
      .from("circle_members")
      .select(`
        *,
        profile:profiles(id, username, display_name, avatar_url, video_avatar_url)
      `)
      .eq("circle_id", circleId)
      .eq("status", "pending")

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch pending members" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      pending_members: pendingMembers || [],
    })
  } catch (error) {
    console.error("Error fetching pending members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Approve or reject a join request
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { id: circleId } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const { memberId, action, role } = body as Record<string, unknown>
    if (typeof memberId !== "string" || !memberId.trim()) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 })
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Action must be approve or reject" }, { status: 400 })
    }

    const actorRole = await getCircleStaffRole(circleId, user.id)
    if (!actorRole) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const requestedRole = role === undefined ? "member" : role
    if (action === "approve" && (typeof requestedRole !== "string" || !canApproveCircleRole(actorRole, requestedRole))) {
      return NextResponse.json({ error: "You cannot approve a request with that role" }, { status: 403 })
    }

    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("name")
      .eq("id", circleId)
      .maybeSingle()
    if (circleError) return NextResponse.json({ error: "Could not load Circle" }, { status: 500 })
    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })

    if (action === "approve") {
      const { data: approved, error } = await supabase
        .from("circle_members")
        .update({
          status: "active",
          role: requestedRole,
          joined_at: new Date().toISOString(),
        })
        .eq("id", memberId)
        .eq("circle_id", circleId)
        .eq("status", "pending")
        .select("user_id")
        .maybeSingle()
      if (error) {
        console.error("Join approval failed:", error)
        return NextResponse.json({ error: "Failed to approve member" }, { status: 500 })
      }
      if (!approved) return NextResponse.json({ error: "Join request is no longer pending" }, { status: 409 })

      const { error: countError } = await syncCircleMemberCount(supabase, circleId)
      if (countError) console.error("Circle member count sync failed after approval:", countError)

      await notifyUser(supabase, {
        userId: approved.user_id,
        type: "circle_join_approved",
        title: "Join request approved",
        message: `You're in! Your request to join ${circle.name} was approved.`,
        actionUrl: `/circles/${circleId}`,
        pushCategory: "circleInvites",
        data: { circleId },
      })
      return NextResponse.json({ success: true, message: "Member approved successfully", role: requestedRole })
    }

    const { data: rejected, error: deleteError } = await supabase
      .from("circle_members")
      .delete()
      .eq("id", memberId)
      .eq("circle_id", circleId)
      .eq("status", "pending")
      .select("user_id")
      .maybeSingle()
    if (deleteError) {
      console.error("Join rejection failed:", deleteError)
      return NextResponse.json({ error: "Failed to reject member" }, { status: 500 })
    }
    if (!rejected) return NextResponse.json({ error: "Join request is no longer pending" }, { status: 409 })

    await notifyUser(supabase, {
      userId: rejected.user_id,
      type: "circle_join_rejected",
      title: "Join request declined",
      message: `Your request to join ${circle.name} was declined.`,
      pushCategory: "circleInvites",
      inAppOnly: true,
      data: { circleId },
    })
    return NextResponse.json({ success: true, message: "Member rejected successfully" })
  } catch (error) {
    console.error("Error processing Circle join request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
