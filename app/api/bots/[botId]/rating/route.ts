import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { getBot } from "@/lib/bot-helpers"

export const dynamic = "force-dynamic"

/** POST /api/bots/[botId]/rating — buyers only. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const bot = await getBot(supabase, botId)
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })

    const { data: purchase } = await supabase
      .from("bot_marketplace_purchases")
      .select("id")
      .eq("bot_id", botId)
      .eq("buyer_id", user.id)
      .maybeSingle()
    if (!purchase) return NextResponse.json({ error: "Only buyers can rate this bot" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const rating = Math.round(Number(body.rating))
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    const comment = String(body.comment || "").slice(0, 300) || null

    const { data: existing } = await supabase
      .from("bot_ratings")
      .select("id, rating")
      .eq("bot_id", botId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from("community_bots")
        .update({
          rating_sum: Math.max(0, bot.rating_sum - existing.rating + rating),
          rating_count: bot.rating_count,
          updated_at: new Date().toISOString(),
        })
        .eq("id", botId)
      const { error } = await supabase
        .from("bot_ratings")
        .update({ rating, comment, created_at: new Date().toISOString() })
        .eq("id", existing.id)
      if (error) return NextResponse.json({ error: "Failed to update rating" }, { status: 500 })
    } else {
      await supabase
        .from("community_bots")
        .update({
          rating_sum: bot.rating_sum + rating,
          rating_count: bot.rating_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", botId)
      const { error } = await supabase
        .from("bot_ratings")
        .insert({ bot_id: botId, user_id: user.id, rating, comment })
      if (error) return NextResponse.json({ error: "Failed to save rating" }, { status: 500 })
    }

    return NextResponse.json({ success: true, rating })
  } catch (e: any) {
    console.error("bot rating error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}