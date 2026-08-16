import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

async function bumpProfileCount(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  field: "followers_count" | "following_count",
  delta: number,
) {
  const { data } = await supabase.from("profiles").select(field).eq("id", userId).maybeSingle()
  const current = Number((data as any)?.[field] || 0)
  await supabase
    .from("profiles")
    .update({ [field]: Math.max(0, current + delta), updated_at: new Date().toISOString() })
    .eq("id", userId)
}

async function tryStatsRpc(
  supabase: ReturnType<typeof createServerClient>,
  targetUserId: string,
  statType: string,
  incrementValue: number,
) {
  try {
    await supabase.rpc("update_user_stats_and_check_achievements", {
      target_user_id: targetUserId,
      stat_type: statType,
      increment_value: incrementValue,
    })
  } catch {
    /* optional legacy RPC */
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const targetUserId = body.target_user_id || body.user_id || body.targetUserId
    const action = body.action === "unfollow" ? "unfollow" : "follow"

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "target_user_id is required" }, { status: 400 })
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 })
    }

    const { data: target } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, privacy_settings")
      .eq("id", targetUserId)
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Private-profile gating: a non-follower can only *request* to follow.
    // "followers" visibility is treated the same as "private" — content is
    // only visible to approved followers, so a request (and approval) is
    // required either way.
    const privacy = (target as any)?.privacy_settings || {}
    const isPrivate = ["private", "followers"].includes(privacy.profile_visibility)

    if (action === "follow" && isPrivate) {
      // The owner can switch off follow requests entirely — then nobody can
      // send a request (existing followers stay untouched).
      if (privacy.allow_friend_requests === false) {
        return NextResponse.json(
          {
            error: "This user isn't accepting follow requests right now.",
            requests_disabled: true,
          },
          { status: 403 },
        )
      }

      const { data: alreadyFollowing } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)
        .maybeSingle()

      if (alreadyFollowing) {
        return NextResponse.json({ success: true, is_following: true, requires_approval: false })
      }

      const { data: pending } = await supabase
        .from("follow_requests")
        .select("id, status")
        .eq("requester_id", user.id)
        .eq("target_id", targetUserId)
        .maybeSingle()

      if (pending) {
        // Already requested — return the current state (idempotent).
        if (pending.status === "declined") {
          // Allow re-requesting after a decline.
          await supabase
            .from("follow_requests")
            .update({ status: "pending", updated_at: new Date().toISOString() })
            .eq("id", pending.id)
        }
        return NextResponse.json({ success: true, requires_approval: true, is_following: false })
      }

      const { error: reqError } = await supabase.from("follow_requests").insert({
        requester_id: user.id,
        target_id: targetUserId,
        status: "pending",
      })
      if (reqError && !/duplicate|unique/i.test(reqError.message || "")) {
        return NextResponse.json({ error: reqError.message }, { status: 500 })
      }

      try {
        const { notifyUser } = await import("@/lib/notifications")
        const name = user.user_metadata?.display_name || user.user_metadata?.username || user.email || "Someone"
        await notifyUser(supabase, {
          userId: targetUserId,
          type: "follow_request",
          title: "New follow request",
          message: `${name} requested to follow you`,
          actorId: user.id,
          actionUrl: `/profile/${user.user_metadata?.username || ""}`,
          data: { requester_id: user.id },
          pushCategory: "social",
        })
      } catch (notifyErr) {
        console.warn("Follow request notify failed:", notifyErr)
      }

      return NextResponse.json({
        success: true,
        requires_approval: true,
        is_following: false,
        message: "Follow request sent — this profile is private.",
      })
    }

    const { data: existing } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle()

    let isFollowing = Boolean(existing)

    if (action === "follow") {
      // If a pending request exists, fulfill it immediately (e.g. the target
      // accepted between page loads).
      if (!existing) {
        await supabase
          .from("follow_requests")
          .update({ status: "approved", updated_at: new Date().toISOString() })
          .eq("requester_id", user.id)
          .eq("target_id", targetUserId)
          .eq("status", "pending")
        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: targetUserId,
          created_at: new Date().toISOString(),
        })

        if (error && !/duplicate|unique/i.test(error.message || "")) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }

        if (!error) {
          await Promise.all([
            bumpProfileCount(supabase, targetUserId, "followers_count", 1),
            bumpProfileCount(supabase, user.id, "following_count", 1),
          ])
          await tryStatsRpc(supabase, targetUserId, "follower_gained", 1)
          await tryStatsRpc(supabase, user.id, "following_added", 1)

          try {
            const { data: actor } = await supabase
              .from("profiles")
              .select("username, display_name, avatar_url")
              .eq("id", user.id)
              .maybeSingle()
            const { notifyUser } = await import("@/lib/notifications")
            const name = actor?.display_name || actor?.username || "Someone"
            await notifyUser(supabase, {
              userId: targetUserId,
              type: "follow",
              title: "New follower",
              message: `${name} started following you`,
              actorId: user.id,
              actionUrl: actor?.username ? `/profile/${actor.username}` : "/notifications",
              data: { follower_id: user.id },
              pushCategory: "social",
            })
          } catch (notifyErr) {
            console.warn("Follow notify failed:", notifyErr)
          }
        }
      }
      isFollowing = true
    } else if (existing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      await Promise.all([
        bumpProfileCount(supabase, targetUserId, "followers_count", -1),
        bumpProfileCount(supabase, user.id, "following_count", -1),
      ])
      await tryStatsRpc(supabase, targetUserId, "follower_gained", -1)
      await tryStatsRpc(supabase, user.id, "following_added", -1)
      isFollowing = false
    } else {
      isFollowing = false
    }

    const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", targetUserId),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
    ])

    return NextResponse.json({
      success: true,
      is_following: isFollowing,
      followers_count: followersCount ?? 0,
      following_count: followingCount ?? 0,
    })
  } catch (error) {
    console.error("Follow error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
