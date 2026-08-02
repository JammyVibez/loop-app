import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") || "active"

    let query = supabase
      .from("loop_duels")
      .select(`
        id,
        prompt,
        creator_id,
        opponent_id,
        circle_id,
        stake_coins,
        duration_hours,
        expires_at,
        status,
        winner_id,
        created_at,
        creator:profiles!creator_id (id, username, display_name, avatar_url),
        opponent:profiles!opponent_id (id, username, display_name, avatar_url),
        entries:loop_duel_entries (id, side, title, content, media_url, votes_count, user_id)
      `)
      .order("created_at", { ascending: false })

    if (status !== "all") {
      query = query.eq("status", status)
    }

    const { data: duels, error } = await query

    if (error) {
      console.error("Error fetching duels:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ duels: duels || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: authData, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authData.user.id
    const body = await req.json()
    const { prompt, opponentUsername, stakeCoins = 50, durationHours = 24, creatorContent = "" } = body

    if (!prompt || !creatorContent) {
      return NextResponse.json({ error: "Prompt and your argument content are required" }, { status: 400 })
    }

    // Resolve opponent profile if username provided
    let opponentId: string | null = null
    if (opponentUsername) {
      const cleanName = opponentUsername.replace("@", "").trim()
      const { data: oppProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanName)
        .single()
      if (oppProfile) {
        opponentId = oppProfile.id
      }
    }

    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString()

    // Create duel
    const { data: duel, error: duelErr } = await supabase
      .from("loop_duels")
      .insert({
        prompt,
        creator_id: userId,
        opponent_id: opponentId,
        stake_coins: Number(stakeCoins),
        duration_hours: Number(durationHours),
        expires_at: expiresAt,
        status: "active",
      })
      .select()
      .single()

    if (duelErr || !duel) {
      console.error("Error creating duel:", duelErr)
      return NextResponse.json({ error: duelErr?.message || "Failed to create duel" }, { status: 500 })
    }

    // Insert Side A entry for creator
    await supabase.from("loop_duel_entries").insert({
      duel_id: duel.id,
      user_id: userId,
      side: "A",
      title: "Challenger Take",
      content: creatorContent,
      votes_count: 0,
    })

    return NextResponse.json({ duel })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
