import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { notifyUser } from "@/lib/notifications";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")

async function isCircleModerator(circleId: string, userId: string): Promise<boolean> {
  const { data: circle } = await supabase.from("circles").select("owner_id, creator_id").eq("id", circleId).maybeSingle()
  if (circle && (circle.owner_id === userId || circle.creator_id === userId)) return true

  const { data: member } = await supabase
    .from("circle_members")
    .select("role")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle()
  return Boolean(member && ["owner", "admin"].includes(member.role))
}

async function getUserFromToken(token: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

// Get pending join requests
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId } = await params

    if (!(await isCircleModerator(circleId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get pending members
    const { data: pendingMembers, error } = await supabase
      .from("circle_members")
      .select(`
        *,
        profile:profiles(id, username, display_name, avatar_url)
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
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId } = await params
    const { memberId, action, role = "member" } = await request.json()

    if (!(await isCircleModerator(circleId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: pendingMember } = await supabase
      .from("circle_members")
      .select("user_id")
      .eq("id", memberId)
      .eq("circle_id", circleId)
      .maybeSingle()

    const { data: circle } = await supabase.from("circles").select("name").eq("id", circleId).maybeSingle()
    const circleName = circle?.name || "the circle"

    if (action === "approve") {
      // Approve the join request
      const { error: updateError } = await supabase
        .from("circle_members")
        .update({ 
          status: "active",
          role: role,
          joined_at: new Date().toISOString()
        })
        .eq("id", memberId)
        .eq("circle_id", circleId)

      if (updateError) {
        console.error("Database update error:", updateError)
        return NextResponse.json({ error: "Failed to approve member" }, { status: 500 })
      }

      if (pendingMember?.user_id) {
        await notifyUser(supabase, {
          userId: pendingMember.user_id,
          type: "circle_join_approved",
          title: "Join request approved",
          message: `You're in! Your request to join ${circleName} was approved.`,
          actionUrl: `/circles/${circleId}`,
          pushCategory: "circleInvites",
          data: { circleId },
        })
      }

      return NextResponse.json({
        success: true,
        message: "Member approved successfully",
      })
    } else if (action === "reject") {
      // Reject the join request (delete the record)
      const { error: deleteError } = await supabase
        .from("circle_members")
        .delete()
        .eq("id", memberId)
        .eq("circle_id", circleId)

      if (deleteError) {
        console.error("Database delete error:", deleteError)
        return NextResponse.json({ error: "Failed to reject member" }, { status: 500 })
      }

      if (pendingMember?.user_id) {
        await notifyUser(supabase, {
          userId: pendingMember.user_id,
          type: "circle_join_rejected",
          title: "Join request declined",
          message: `Your request to join ${circleName} was declined.`,
          pushCategory: "circleInvites",
          inAppOnly: true,
          data: { circleId },
        })
      }

      return NextResponse.json({
        success: true,
        message: "Member rejected successfully",
      })
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error processing join request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
