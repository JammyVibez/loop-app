import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()

    const { session_id, inviter_username, inviter_id: reqInviterId, invitee_id: reqInviteeId } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
    }

    // Determine inviter and invitee IDs
    let inviterId: string | null = reqInviterId || null
    let inviteeId: string | null = reqInviteeId || null

    if (!inviterId && inviter_username) {
      const { data: inviterProf } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", inviter_username.toLowerCase().trim())
        .single()
      if (inviterProf) inviterId = inviterProf.id
    }

    // If currentUser is invitee and inviterId is present:
    if (!inviteeId && inviterId && currentUser.id !== inviterId) {
      inviteeId = currentUser.id
    } else if (!inviterId && currentUser.id !== inviteeId) {
      inviterId = currentUser.id
    }

    if (!inviterId || !inviteeId) {
      return NextResponse.json(
        { success: false, reason: "missing_participants", message: "Could not identify both inviter and invitee" },
        { status: 400 }
      )
    }

    if (inviterId === inviteeId) {
      return NextResponse.json(
        { success: false, reason: "self_invite", message: "Cannot claim reward for inviting yourself" },
        { status: 400 }
      )
    }

    // Fetch both profiles
    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, loop_coins")
      .eq("id", inviterId)
      .single()

    const { data: inviteeProfile } = await supabase
      .from("profiles")
      .select("id, username, display_name, loop_coins, created_at, invited_via_coloop")
      .eq("id", inviteeId)
      .single()

    if (!inviterProfile || !inviteeProfile) {
      return NextResponse.json(
        { success: false, reason: "user_not_found", message: "User profiles not found" },
        { status: 404 }
      )
    }

    // SAFEGUARD 1: Max once per unique inviter-invitee pair ever
    const { data: existingPairReward } = await supabase
      .from("co_loop_invite_rewards")
      .select("id")
      .or(
        `and(inviter_id.eq.${inviterId},invitee_id.eq.${inviteeId}),and(inviter_id.eq.${inviteeId},invitee_id.eq.${inviterId})`
      )
      .maybeSingle()

    if (existingPairReward) {
      return NextResponse.json({
        success: false,
        reason: "pair_already_rewarded",
        message: "Reward already claimed for this pair of collaborators",
      })
    }

    // SAFEGUARD 2: Account eligibility on invitee
    // Must be newly created via co-loop flow (invited_via_coloop = true) OR account older than 24 hours
    const accountAgeMs = Date.now() - new Date(inviteeProfile.created_at || Date.now()).getTime()
    const isNewViaFlow = Boolean(inviteeProfile.invited_via_coloop)
    const isEstablished = accountAgeMs >= 24 * 60 * 60 * 1000 // 24 hours

    if (!isNewViaFlow && !isEstablished) {
      return NextResponse.json({
        success: false,
        reason: "account_not_eligible",
        message: "Invitee account must be newly registered via invite link or older than 24 hours to earn activation rewards",
      })
    }

    // SAFEGUARD 3: Daily cap on inviter (max 5 rewards per 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: dailyCount } = await supabase
      .from("co_loop_invite_rewards")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", inviterId)
      .gte("created_at", twentyFourHoursAgo)

    if (dailyCount && dailyCount >= 5) {
      return NextResponse.json({
        success: false,
        reason: "daily_limit_reached",
        message: "Inviter has reached the daily limit of 5 Co-Loop collaboration rewards",
      })
    }

    // ALL SAFEGUARDS PASSED -> AWARD REWARD
    const coinsBonus = 50

    // 1. Record reward pair
    const { error: insertError } = await supabase.from("co_loop_invite_rewards").insert({
      inviter_id: inviterId,
      invitee_id: inviteeId,
      session_id,
      coins_awarded: coinsBonus,
      created_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error("Failed inserting co_loop_invite_rewards record:", insertError)
      return NextResponse.json(
        { success: false, reason: "database_error", message: "Failed to record reward" },
        { status: 500 }
      )
    }

    // 2. Increment coins for inviter
    const newInviterCoins = (inviterProfile.loop_coins || 0) + coinsBonus
    await supabase.from("profiles").update({ loop_coins: newInviterCoins }).eq("id", inviterId)

    // 3. Increment coins for invitee
    const newInviteeCoins = (inviteeProfile.loop_coins || 0) + coinsBonus
    await supabase.from("profiles").update({ loop_coins: newInviteeCoins }).eq("id", inviteeId)

    // 4. Send Notifications
    await supabase.from("notifications").insert([
      {
        user_id: inviterId,
        type: "co_loop_reward",
        title: "🎉 Co-Loop Reward Activated (+50 Coins)!",
        message: `You and @${inviteeProfile.username} both earned +50 Loop Coins for co-authoring a Loop together!`,
        data: { session_id, coins: coinsBonus, collaborator_id: inviteeId },
        is_read: false,
      },
      {
        user_id: inviteeId,
        type: "co_loop_reward",
        title: "🎉 Co-Loop Welcome Bonus (+50 Coins)!",
        message: `You and @${inviterProfile.username} both earned +50 Loop Coins for co-authoring a Loop together!`,
        data: { session_id, coins: coinsBonus, collaborator_id: inviterId },
        is_read: false,
      },
    ])

    // 5. Insert coin transactions log if table available
    try {
      await supabase.from("coin_transactions").insert([
        {
          user_id: inviterId,
          amount: coinsBonus,
          transaction_type: "co_loop_invite_reward",
          description: `Co-Loop activation reward with @${inviteeProfile.username}`,
          created_at: new Date().toISOString(),
        },
        {
          user_id: inviteeId,
          amount: coinsBonus,
          transaction_type: "co_loop_invite_reward",
          description: `Co-Loop activation reward with @${inviterProfile.username}`,
          created_at: new Date().toISOString(),
        },
      ])
    } catch (txErr) {
      console.warn("Non-fatal: transaction logging skipped", txErr)
    }

    return NextResponse.json({
      success: true,
      coins_awarded: coinsBonus,
      message: `🎉 +50 Loop Coins awarded to @${inviterProfile.username} and @${inviteeProfile.username}!`,
    })
  } catch (error: any) {
    console.error("Co-Loop reward error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
