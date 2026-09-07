import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { getBot, logBotActivity } from "@/lib/bot-helpers"

export const dynamic = "force-dynamic"

/** PATCH /api/bots/[botId]/marketplace — owner lists/unlists the bot with a price. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const bot = await getBot(supabase, botId)
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    if (bot.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the creator can sell this bot" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    if (!body.secret_token || body.secret_token !== bot.secret_token) {
      return NextResponse.json({ error: "Bot secret token required" }, { status: 403 })
    }

    const price = Math.max(0, Math.min(Number(body.price_coins) || 0, 1_000_000))
    const patch: Record<string, any> = {
      is_listed: Boolean(body.is_listed),
      price_coins: price,
      updated_at: new Date().toISOString(),
    }
    if (typeof body.allows_hosted === "boolean") patch.allows_hosted = body.allows_hosted
    if (typeof body.allows_source === "boolean") patch.allows_source = body.allows_source

    if (patch.is_listed) {
      // A listing needs at least one purchasable option.
      if (!patch.allows_hosted && !patch.allows_source) {
        return NextResponse.json({ error: "Enable Hosted Access and/or Source Code to list the bot" }, { status: 400 })
      }
      if (price <= 0) {
        return NextResponse.json({ error: "Set a price in Loop Coins (minimum 1)" }, { status: 400 })
      }
      if (patch.allows_source && !bot.source_url) {
        return NextResponse.json({ error: "Add a source URL/repo before selling the source code" }, { status: 400 })
      }
    }

    const { data: updated, error } = await supabase
      .from("community_bots")
      .update(patch)
      .eq("id", botId)
      .select(`*, owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified)`)
      .single()

    if (error) return NextResponse.json({ error: "Failed to update listing" }, { status: 500 })

    await logBotActivity(supabase, {
      bot_id: botId,
      community_id: bot.community_id,
      actor_id: user.id,
      type: "purchase",
      title: patch.is_listed ? `${bot.name} listed in the Marketplace` : `${bot.name} removed from the Marketplace`,
      message: patch.is_listed ? `Now available for ${price} Loop Coins.` : "No longer for sale.",
    })

    return NextResponse.json({ success: true, bot: updated })
  } catch (e: any) {
    console.error("marketplace update error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}