import { type NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/calls/logs — fetch the user's call history (both incoming and outgoing).
 * Returns call sessions with participant info, duration, and status.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100)
    const offset = parseInt(url.searchParams.get("offset") || "0")

    // Fetch call sessions where the user is the creator or a conversation participant
    // We need to join with profiles to get the other person's info
    const { data: createdCalls, error: createdError } = await supabase
      .from("call_sessions")
      .select(`
        *,
        conversation:conversations!conversation_id (
          id,
          is_group,
          name
        )
      `)
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit + offset + 50)

    if (createdError) {
      console.error("[call-logs] fetch created calls error:", createdError.message)
    }

    // Fetch calls where the user was a participant (in conversations they're part of)
    const { data: participantConversations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id)

    const convoIds = (participantConversations || []).map((p: any) => p.conversation_id)

    let receivedCalls: any[] = []
    if (convoIds.length > 0) {
      // Chunk the IN query to avoid too many OR conditions
      const chunks: string[][] = []
      for (let i = 0; i < convoIds.length; i += 20) {
        chunks.push(convoIds.slice(i, i + 20))
      }

      for (const chunk of chunks) {
        const { data } = await supabase
          .from("call_sessions")
          .select(`
            *,
            conversation:conversations!conversation_id (
              id,
              is_group,
              name
            )
          `)
          .in("conversation_id", chunk)
          .neq("creator_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit)
        if (data) receivedCalls.push(...data)
      }
    }

    // Merge and deduplicate
    const allCalls = [...(createdCalls || []), ...receivedCalls]
    const seen = new Set<string>()
    const uniqueCalls = allCalls.filter((call: any) => {
      if (seen.has(call.id)) return false
      seen.add(call.id)
      return true
    })

    // Sort by created_at descending
    uniqueCalls.sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    // Paginate
    const paginated = uniqueCalls.slice(offset, offset + limit)

    // Fetch profiles for the "other" user in each call
    const profileIds = new Set<string>()
    for (const call of paginated) {
      if (call.creator_id !== user.id) profileIds.add(call.creator_id)
      // For group calls, we just show "Group call"
    }

    let profileMap: Record<string, any> = {}
    if (profileIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", Array.from(profileIds))
      if (profiles) {
        for (const p of profiles) profileMap[p.id] = p
      }
    }

    // Enrich calls with other_user info
    const enriched = paginated.map((call: any) => {
      const isOutgoing = call.creator_id === user.id
      const otherUserId = isOutgoing
        ? null // We were the caller, so we need participants info
        : call.creator_id
      const otherUser = otherUserId ? profileMap[otherUserId] : null

      // Calculate duration
      let duration = 0
      if (call.started_at && call.ended_at) {
        duration = Math.round(
          (new Date(call.ended_at).getTime() - new Date(call.started_at).getTime()) / 1000
        )
      }

      return {
        ...call,
        is_outgoing: isOutgoing,
        other_user: otherUser,
        duration_seconds: duration,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        calls: enriched,
        total: uniqueCalls.length,
        has_more: offset + limit < uniqueCalls.length,
      },
    })
  } catch (error: any) {
    console.error("[call-logs] error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to load call logs" },
      { status: 500 }
    )
  }
}
