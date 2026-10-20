import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { processMentions, extractMentions, attachMentionsColumn } from "@/lib/mentions"
import { getUserFromRequest } from "@/lib/server-auth"

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "active"
    const loopId = searchParams.get("loop_id")
    const duelId = searchParams.get("id")

    let query = supabase
      .from("loop_duels")
      .select(`
        *,
        creator:profiles!creator_id (id, username, display_name, avatar_url, video_avatar_url),
        opponent:profiles!opponent_id (id, username, display_name, avatar_url, video_avatar_url),
        entries:loop_duel_entries (id, side, title, content, media_url, votes_count, user_id)
      `)
      .order("created_at", { ascending: false })

    if (loopId) {
      query = query.eq("loop_id", loopId)
    } else if (duelId) {
      query = query.eq("id", duelId)
    }

    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data: duels, error } = await query

    if (error) {
      console.error("Error fetching duels:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let rows = duels || []

    // The global list of duels is public. Duels created inside a private
    // community must never surface there — only when the caller is asking for
    // one specific duel (loop_id / id), which the community itself does.
    if (!loopId && !duelId && rows.length > 0) {
      const circleIds = [...new Set(rows.map((d: any) => d.circle_id).filter((id: any) => id != null))]
      if (circleIds.length > 0) {
        const { data: circles } = await supabase.from("circles").select("id, is_private").in("id", circleIds)
        const privateIds = new Set((circles || []).filter((c: any) => c.is_private).map((c: any) => String(c.id)))
        if (privateIds.size > 0) {
          rows = rows.filter((d: any) => !privateIds.has(String(d.circle_id)))
        }
      }
    }

    return NextResponse.json({ duels: rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
    const body = await req.json()
    const { prompt, opponentUsername, stakeCoins = 50, durationHours = 24, creatorContent = "", creatorMediaUrl = null, sideA_label = null, sideB_label = null } = body

    if (!prompt || !creatorContent) {
      return NextResponse.json({ error: "Prompt and your argument content are required" }, { status: 400 })
    }

    // ── Community context ──
    // A Duel launched from a community belongs to that community and is
    // community-only unless the member explicitly shares it to the Loop feed.
    // Private communities can never produce a public Duel.
    const circleId = body.circle_id ?? body.circleId ?? null
    const shareToFeed = Boolean(body.share_to_feed)
    let community: { id: string | number; name?: string | null; handle?: string | null } | null = null
    let communityIsPrivate = false
    if (circleId) {
      const { data: circleRow } = await supabase
        .from("circles")
        .select("id, name, handle, is_private")
        .eq("id", circleId)
        .maybeSingle()
      if (circleRow) {
        communityIsPrivate = Boolean(circleRow.is_private)
        const { data: membership } = await supabase
          .from("circle_members")
          .select("status")
          .eq("circle_id", circleRow.id)
          .eq("user_id", userId)
          .maybeSingle()
        const isMember = Boolean(membership && ["active", "approved"].includes(String(membership.status)))
        if (isMember) community = { id: circleRow.id, name: circleRow.name, handle: circleRow.handle }
      }
    }

    // Resolve opponent profile if username provided
    let opponentId: string | null = null
    if (opponentUsername) {
      const cleanName = opponentUsername.replace("@", "").trim()
      const { data: oppProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanName)
        .maybeSingle()
      if (oppProfile) {
        opponentId = oppProfile.id
      }
    }

    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString()

    // 1. Create parent loop record so the duel post displays in feed and profile pages
    const fullText = `${prompt}\n\n${creatorContent}${opponentUsername ? ` @${opponentUsername.replace("@", "")}` : ""}`
    // Community-only by default; a private community is always community-only.
    const loopVisibility = !community ? "public" : shareToFeed && !communityIsPrivate ? "public" : "private"
    const { data: loopRecord, error: loopErr } = await supabase
      .from("loops")
      .insert({
        author_id: userId,
        content: prompt,
        content_text: fullText,
        content_title: prompt.slice(0, 80),
        content_type: "duel",
        post_type: "duel",
        visibility: loopVisibility,
        category: "general",
        ...(community ? { circle_id: community.id } : {}),
        content_metadata: community
          ? { community: { id: community.id, name: community.name || null, handle: community.handle || null } }
          : undefined,
      })
      .select()
      .single()

    const loopId = loopRecord?.id || null

    // 2. Create duel record
    const { data: duel, error: duelErr } = await supabase
      .from("loop_duels")
      .insert({
        loop_id: loopId,
        prompt,
        creator_id: userId,
        opponent_id: opponentId,
        stake_coins: Number(stakeCoins),
        duration_hours: Number(durationHours),
        expires_at: expiresAt,
        side_a_label: sideA_label || null,
        side_b_label: sideB_label || null,
        status: "active",
        ...(community ? { circle_id: community.id } : {}),
      })
      .select()
      .single()

    if (duelErr || !duel) {
      console.error("Error creating duel:", duelErr)
      return NextResponse.json({ error: duelErr?.message || "Failed to create duel" }, { status: 500 })
    }

    // 3. Insert Side A entry for creator (media_url supports image/video duels)
    await supabase.from("loop_duel_entries").insert({
      duel_id: duel.id,
      user_id: userId,
      side: "A",
      title: "Challenger Take",
      content: creatorContent,
      media_url: creatorMediaUrl || null,
      votes_count: 0,
    })

    // 4. Process mentions for tagged users
    try {
      const usernames = extractMentions(fullText)
      if (loopId && usernames.length) {
        await attachMentionsColumn(supabase, "loops", loopId, usernames)
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", userId)
          .maybeSingle()
        await processMentions(supabase, fullText, {
          source: "loop",
          loop_id: loopId,
          actor_id: userId,
          actor_username: actorProfile?.username,
          actor_display_name: actorProfile?.display_name,
        })
      }
    } catch (mentionErr) {
      console.error("Duel mention error:", mentionErr)
    }

    return NextResponse.json({ duel, loop: loopRecord })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

