import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { notifyUsers } from "@/lib/notifications";
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")


export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: circleId } = await params
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("id, name, is_private, owner_id, creator_id")
      .eq("id", circleId)
      .maybeSingle()

    if (circleError) {
      console.error("Could not load Circle before join:", circleError)
      return NextResponse.json({ error: "Could not load Circle" }, { status: 500 })
    }
    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })

    // One row-locked database operation enforces account status, existing
    // membership, private approval and max_members consistently under load.
    const { data, error: joinError } = await supabase.rpc("join_circle", {
      p_circle_id: circleId,
      p_user_id: user.id,
    })

    if (joinError) {
      console.error("Atomic Circle join failed:", joinError)
      if (joinError.code === "P0002") return NextResponse.json({ error: "Circle or account not found" }, { status: 404 })
      if (joinError.code === "42501") {
        return NextResponse.json({ error: joinError.message || "This account cannot join the Circle" }, { status: 403 })
      }
      if (joinError.code === "22023") {
        return NextResponse.json({ error: joinError.message || "This Circle is full" }, { status: 409 })
      }
      if (["42883", "42P01", "42703"].includes(joinError.code || "")) {
        return NextResponse.json({ error: "Circle membership is unavailable until the database migration is applied." }, { status: 503 })
      }
      return NextResponse.json({ error: "Failed to update Circle membership" }, { status: 500 })
    }

    const result = (Array.isArray(data) ? data[0] : data) as {
      status?: string
      already_member?: boolean
      is_private?: boolean
    } | null

    if (!result || !["active", "pending"].includes(result.status || "")) {
      console.error("join_circle returned an unexpected result")
      return NextResponse.json({ error: "Circle membership returned an invalid result" }, { status: 500 })
    }

    if (result.already_member) {
      return NextResponse.json({
        success: true,
        status: result.status,
        message: result.status === "pending" ? "Join request is already pending" : "Already a member",
      })
    }

    if (result.status === "pending") {
      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle()
      const requesterName = requesterProfile?.display_name || requesterProfile?.username || "Someone"

      const { data: moderators } = await supabase
        .from("circle_members")
        .select("user_id")
        .eq("circle_id", circleId)
        .eq("status", "active")
        .in("role", ["owner", "admin", "moderator"])

      const recipients = new Set<string>([circle.owner_id, circle.creator_id].filter(Boolean) as string[])
      for (const moderator of moderators || []) recipients.add(moderator.user_id)
      recipients.delete(user.id)

      await notifyUsers(supabase, Array.from(recipients), {
        type: "circle_join_request",
        title: "New join request",
        message: `${requesterName} wants to join ${circle.name}`,
        actionUrl: `/circles/${circleId}/admin`,
        actorId: user.id,
        pushCategory: "circleInvites",
        data: { circleId },
      })
      return NextResponse.json({
        success: true,
        message: "Join request sent to moderators",
        status: "pending",
      }, { status: 202 })
    }

    // Post-commit effects are idempotent/best-effort; membership is already
    // committed and the canonical member count was updated by the DB function.
    try {
      const { data: defaultRole } = await supabase
        .from("community_roles")
        .select("id")
        .eq("circle_id", circleId)
        .eq("is_default", true)
        .maybeSingle()
      if (defaultRole?.id) {
        await supabase
          .from("community_member_roles")
          .upsert(
            { circle_id: circleId, user_id: user.id, role_id: defaultRole.id },
            { onConflict: "user_id,role_id" },
          )
      }
    } catch (error) {
      console.error("Default Circle power grant failed:", error)
    }

    try {
      const { runWelcomeBot } = await import("@/lib/circle-bots")
      await runWelcomeBot(supabase, circleId, user.id)
    } catch (error) {
      console.error("Circle welcome bot failed:", error)
    }

    try {
      const { trackQuestAction } = await import("@/lib/quest-tracker")
      await trackQuestAction(supabase, user.id, "join_circle")
    } catch (error) {
      console.error("Circle join quest tracking failed:", error)
    }

    return NextResponse.json({
      success: true,
      message: "Successfully joined Circle",
      status: "active",
    })
  } catch (error) {
    console.error("Error joining Circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { id: circleId } = await params
    const { data: circle, error: circleError } = await supabase
      .from("circles").select("id, owner_id").eq("id", circleId).maybeSingle()
    if (circleError) return NextResponse.json({ error: "Could not load Circle" }, { status: 500 })
    if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 })

    const { data: membership, error: membershipError } = await supabase
      .from("circle_members").select("id, role, status")
      .eq("circle_id", circleId).eq("user_id", user.id).maybeSingle()
    if (membershipError) return NextResponse.json({ error: "Could not load membership" }, { status: 500 })
    if (!membership) return NextResponse.json({ error: "No membership or pending request was found" }, { status: 404 })
    if (membership.status === "banned") return NextResponse.json({ error: "A ban cannot be removed by leaving the Circle" }, { status: 403 })
    if (membership.role === "owner" || circle.owner_id === user.id) {
      return NextResponse.json({ error: "Transfer Circle ownership before leaving" }, { status: 409 })
    }
    if (!["active", "approved", "pending"].includes(membership.status)) {
      return NextResponse.json({ error: "This Circle membership cannot be withdrawn" }, { status: 409 })
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from("circle_members").delete().eq("id", membership.id)
      .eq("status", membership.status).select("id")
    if (deleteError) return NextResponse.json({ error: "Failed to update Circle membership" }, { status: 500 })
    if (!deletedRows?.length) return NextResponse.json({ error: "Membership changed. Refresh and try again." }, { status: 409 })

    const wasMember = membership.status === "active" || membership.status === "approved"
    if (wasMember) {
      try {
        const { syncCircleMemberCount } = await import("@/lib/circle-lifecycle")
        await syncCircleMemberCount(supabase, circleId)
      } catch (err) {
        console.error("member count sync:", err)
      }
    }
    return NextResponse.json({
      success: true,
      status: wasMember ? "left" : "cancelled",
      message: wasMember ? "Successfully left Circle" : "Join request cancelled",
    })
  } catch (error) {
    console.error("Error updating Circle membership:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
