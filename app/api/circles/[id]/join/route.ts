import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { notifyUsers } from "@/lib/notifications";
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder")


export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId } = await params

    // Check if circle exists
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("id, name, is_private, owner_id, creator_id")
      .eq("id", circleId)
      .maybeSingle()

    if (circleError || !circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Check if user is already a member (or was previously removed/banned)
    const { data: existingMember } = await supabase
      .from("circle_members")
      .select("id, status")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingMember) {
      if (existingMember.status === "active") {
        return NextResponse.json({ error: "Already a member" }, { status: 400 })
      } else if (existingMember.status === "pending") {
        return NextResponse.json({ error: "Join request already pending" }, { status: 400 })
      } else if (existingMember.status === "banned") {
        return NextResponse.json({ error: "You cannot rejoin this circle" }, { status: 403 })
      }
    }

    // For private circles, create a pending request
    const status = circle.is_private ? "pending" : "active"

    // Re-joining (e.g. after leaving) reuses the existing row instead of a
    // fresh insert, which previously hit the unique constraint and 500'd.
    const { error: upsertError } = existingMember
      ? await supabase
          .from("circle_members")
          .update({ role: "member", status, joined_at: new Date().toISOString() })
          .eq("id", existingMember.id)
      : await supabase.from("circle_members").insert({
          circle_id: circleId,
          user_id: user.id,
          role: "member",
          status,
          joined_at: new Date().toISOString(),
        })

    if (upsertError) {
      console.error("Database insert error:", upsertError)
      return NextResponse.json({ error: "Failed to join circle" }, { status: 500 })
    }

    if (circle.is_private) {
      // Notify owner + admins/moderators so pending requests don't sit unseen.
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

      const recipientIds = new Set<string>([circle.owner_id, circle.creator_id].filter(Boolean) as string[])
      for (const mod of moderators || []) recipientIds.add(mod.user_id)
      recipientIds.delete(user.id)

      await notifyUsers(supabase, Array.from(recipientIds), {
        type: "circle_join_request",
        title: "New join request",
        message: `${requesterName} wants to join ${circle.name}`,
        actionUrl: `/circles/${circleId}/admin`,
        actorId: user.id,
        pushCategory: "circleInvites",
        data: { circleId },
      })
    }

    // Welcome bot — greets new members the moment they join (public circles).
    if (status === "active") {
      // The default-Power grant runs on INSERT (trg_grant_default_powers), but
      // rejoining reuses the row with an UPDATE — so anyone who left and came
      // back would silently hold no Powers. Grant it explicitly, idempotently.
      try {
        const { data: defRole } = await supabase
          .from("community_roles")
          .select("id")
          .eq("circle_id", circleId)
          .eq("is_default", true)
          .maybeSingle()
        if (defRole?.id) {
          await supabase
            .from("community_member_roles")
            .upsert(
              { circle_id: circleId, user_id: user.id, role_id: defRole.id },
              { onConflict: "user_id,role_id" },
            )
        }
      } catch (err) {
        console.error("default power grant:", err)
      }
      try {
        const { runWelcomeBot } = await import("@/lib/circle-bots")
        await runWelcomeBot(supabase, circleId, user.id)
      } catch (err) {
        console.error("welcome bot:", err)
      }

      // Community tags on the profile are user-curated (Settings → Communities)
      // and are no longer auto-added on join — joining must not modify the
      // member's profile.

      // Quest progress: join_circle native action
      try {
        const { trackQuestAction } = await import("@/lib/quest-tracker")
        await trackQuestAction(supabase, user.id, "join_circle")
      } catch (err) {
        console.error("quest track (join_circle):", err)
      }
    }

    return NextResponse.json({
      success: true,
      message: circle.is_private ? "Join request sent to moderators" : "Successfully joined circle",
      status,
    })
  } catch (error) {
    console.error("Error joining circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { id: circleId } = await params

    // Remove user from circle
    const { error: deleteError } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", circleId)
      .eq("user_id", user.id)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to leave circle" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Successfully left circle",
    })
  } catch (error) {
    console.error("Error leaving circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
