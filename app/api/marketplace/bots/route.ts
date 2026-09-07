import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { logBotActivity } from "@/lib/bot-helpers"

export const dynamic = "force-dynamic"

const BOT_SELECT = `
  *,
  owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified)
`

/** GET /api/marketplace/bots — browse listings (category + search filters). */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const search = searchParams.get("search")

    const supabase = createServerClient()
    let query = supabase
      .from("community_bots")
      .select(BOT_SELECT)
      .eq("is_listed", true)
      .order("rating_sum", { ascending: false })

    if (category && category !== "all") query = query.eq("category", category)
    if (search) query = query.ilike("name", `%${search}%`)

    const { data: bots, error } = await query.limit(60)
    if (error) return NextResponse.json({ error: "Failed to load marketplace" }, { status: 500 })

    // Pull community name for each bot.
    const communityIds = [...new Set((bots || []).map((b: any) => b.community_id))]
    const { data: communities } = await supabase
      .from("circles")
      .select("id, name")
      .in("id", communityIds)

    const communityName = new Map((communities || []).map((c: any) => [c.id, c.name]))
    const safe = (bots || []).map((b: any) => ({
      ...b,
      secret_token: undefined,
      community_name: communityName.get(b.community_id) || null,
      rating_avg: b.rating_count > 0 ? Math.round((b.rating_sum / b.rating_count) * 10) / 10 : 0,
    }))

    return NextResponse.json({ success: true, bots: safe })
  } catch (e: any) {
    console.error("marketplace list error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/marketplace/bots — buy usage rights (hosted) or the source code.
 * Ownership NEVER transfers; the buyer receives access or code + instructions.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to buy bots" }, { status: 401 })

    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const botId = String(body.bot_id || "")
    const purchaseType = body.purchase_type === "source" ? "source" : "hosted"

    const { data: bot } = await supabase.from("community_bots").select(BOT_SELECT).eq("id", botId).eq("is_listed", true).maybeSingle()
    if (!bot) return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    if (bot.owner_id === user.id) return NextResponse.json({ error: "You already own this bot" }, { status: 400 })

    if (purchaseType === "hosted" && !bot.allows_hosted) {
      return NextResponse.json({ error: "Hosted Access is not for sale for this bot" }, { status: 400 })
    }
    if (purchaseType === "source") {
      if (!bot.allows_source) return NextResponse.json({ error: "Source Code is not for sale for this bot" }, { status: 400 })
      if (!bot.source_url) return NextResponse.json({ error: "Seller hasn't attached the source yet" }, { status: 400 })
    }

    // Already purchased this type?
    const { data: existing } = await supabase
      .from("bot_marketplace_purchases")
      .select("id")
      .eq("bot_id", botId)
      .eq("buyer_id", user.id)
      .eq("purchase_type", purchaseType)
      .maybeSingle()
    if (existing) return NextResponse.json({ error: "You already bought this package" }, { status: 409 })

    const price = Number(bot.price_coins) || 0
    if (price <= 0) return NextResponse.json({ error: "Invalid listing price" }, { status: 400 })

    // Fresh buyer balance from the DB — never trust the client object.
    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("id, loop_coins, username")
      .eq("id", user.id)
      .maybeSingle()
    const buyerCoins = Number(buyerProfile?.loop_coins ?? 0)

    // Atomic coin deduction.
    const { data: buyer, error: deductErr } = await supabase
      .from("profiles")
      .update({ loop_coins: buyerCoins - price, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .gte("loop_coins", price)
      .select("id, loop_coins")
      .single()
    if (deductErr || !buyer) {
      return NextResponse.json({ error: "Insufficient Loop Coins" }, { status: 400 })
    }

    // Credit the seller (coins already escrowed by the deduction).
    await supabase
      .from("profiles")
      .update({ loop_coins: Number(bot.owner?.loop_coins ?? 0) + price, updated_at: new Date().toISOString() })
      .eq("id", bot.owner_id)

    const delivery =
      purchaseType === "source"
        ? `Source code: ${bot.source_url}\nRun instructions: deploy the repo on your own hosting (Render/Vercel/any Node host), add your own bot token, and you're live. Ownership of the original listing stays with @${bot.owner?.username}.`
        : `Hosted access: ${bot.invite_link || "Ask the seller for the invite link"}\nThe creator keeps hosting this bot — you can now use it in your own community.`

    const { data: purchase, error: purchaseErr } = await supabase
      .from("bot_marketplace_purchases")
      .insert({
        bot_id: botId,
        seller_id: bot.owner_id,
        buyer_id: user.id,
        community_id: bot.community_id || null,
        purchase_type: purchaseType,
        price_coins: price,
        delivery,
      })
      .select()
      .single()
    if (purchaseErr) {
      // Refund the buyer — roll back the deduction.
      await supabase
        .from("profiles")
        .update({ loop_coins: Number(buyer.loop_coins) + price, updated_at: new Date().toISOString() })
        .eq("id", user.id)
      return NextResponse.json({ error: "Purchase failed — coins refunded" }, { status: 500 })
    }

    await supabase
      .from("community_bots")
      .update({ purchase_count: Number(bot.purchase_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", botId)

    await logBotActivity(supabase, {
      bot_id: botId,
      community_id: bot.community_id,
      actor_id: user.id,
      type: "purchase",
      title: `${bot.name} sold`,
      message: `@${buyerProfile?.username || "A member"} bought ${purchaseType === "source" ? "the source code" : "hosted access"} for ${price} coins.`,
    })

    return NextResponse.json({
      success: true,
      purchase: { id: purchase.id, purchase_type: purchaseType, price_coins: price },
      delivery,
      new_balance: buyer.loop_coins,
    })
  } catch (e: any) {
    console.error("marketplace purchase error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}