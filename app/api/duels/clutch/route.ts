import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { processMentions, extractMentions, attachMentionsColumn } from "@/lib/mentions"
import { getUserFromRequest } from "@/lib/server-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

const MIN_WINDOW = 10
const MAX_WINDOW = 300
const MIN_STAKE = 5
const MAX_STAKE = 1000

export async function POST(req: NextRequest) {
  try {

    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authUser.id
    const body = await req.json()
    const {
      clipUrl,
      question,
      predictionWindowSeconds = 20,
      stakeCoins = 0,
      content = "",
      hashtags = [],
    } = body

    if (!clipUrl || !question?.trim()) {
      return NextResponse.json({ error: "A clip URL and prediction question are required" }, { status: 400 })
    }

    const windowSeconds = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, Number(predictionWindowSeconds) || 20))
    const stake = Math.min(MAX_STAKE, Math.max(0, Number(stakeCoins) || 0))

    const loopText = `${question.trim()}\n\n${content?.trim() || ""}`.trim()

    // 1. Create parent loop record so the duel shows in feed/profile pages.
    const { data: loopRecord, error: loopErr } = await supabase
      .from("loops")
      .insert({
        author_id: userId,
        content: question.trim(),
        content_text: loopText,
        content_title: question.trim().slice(0, 80),
        content_type: "duel",
        post_type: "duel",
        visibility: "public",
        category: "gaming",
        hashtags: Array.isArray(hashtags) ? hashtags : [],
      })
      .select()
      .single()

    if (loopErr || !loopRecord) {
      console.error("Clutch duel loop error:", loopErr)
      return NextResponse.json({ error: loopErr?.message || "Failed to create loop" }, { status: 500 })
    }

    const loopId = loopRecord.id
    const bettingEndsAt = new Date(Date.now() + windowSeconds * 1000).toISOString()

    // 2. Create the duel record — a themed extension of loop_duels.
    const { data: duel, error: duelErr } = await supabase
      .from("loop_duels")
      .insert({
        loop_id: loopId,
        prompt: question.trim(),
        creator_id: userId,
        stake_coins: stake,
        duration_hours: Math.max(1, Math.round(windowSeconds / 3600)),
        expires_at: bettingEndsAt,
        status: "active",
        duel_type: "clutch",
        clip_url: clipUrl,
        prediction_question: question.trim(),
        betting_ends_at: bettingEndsAt,
        correct_side: null,
        outcome_revealed: false,
        payout_processed: false,
        yes_stake: 0,
        no_stake: 0,
      })
      .select()
      .single()

    if (duelErr || !duel) {
      console.error("Clutch duel create error:", duelErr)
      return NextResponse.json({ error: duelErr?.message || "Failed to create clutch duel" }, { status: 500 })
    }

    // 3. Process mentions for tagged users.
    try {
      const usernames = extractMentions(loopText)
      if (loopId && usernames.length) {
        await attachMentionsColumn(supabase, "loops", loopId, usernames)
        const { data: actorProfile } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", userId)
          .maybeSingle()
        await processMentions(supabase, loopText, {
          source: "loop",
          loop_id: loopId,
          actor_id: userId,
          actor_username: actorProfile?.username,
          actor_display_name: actorProfile?.display_name,
        })
      }
    } catch (mentionErr) {
      console.error("Clutch duel mention error:", mentionErr)
    }

    return NextResponse.json({ duel, loop: loopRecord, betting_ends_at: bettingEndsAt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
