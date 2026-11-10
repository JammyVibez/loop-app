import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { findCanonicalGift } from "@/lib/gifts/catalog"
import { giftCoinValue, giftConvertedAt } from "@/lib/gifts/conversion"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}


export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServerClient()

    // Fetch gifts received by user
    const { data: giftsReceived } = await supabase
      .from("coin_gifts")
      .select("*")
      .eq("receiver_id", user.id)
      .order("created_at", { ascending: false })

    // Fetch gifts sent by user
    const { data: giftsSent } = await supabase
      .from("coin_gifts")
      .select("*")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })

    // Fetch user inventory items
    const { data: inventory } = await supabase
      .from("user_inventory")
      .select("*")
      .eq("user_id", user.id)
      .order("acquired_at", { ascending: false })

    // Accepted collectible gifts are separate from coin_gifts. The wallet shows
    // their keep-or-convert value, so load the claimed gift rows as well.
    const { data: claimedGifts } = await supabase
      .from("gifts")
      .select(
        "id, gift_name, name, gift_type, gift_value, cost, rarity, status, context_type, context_id, created_at",
      )
      .eq("recipient_id", user.id)
      .eq("status", "claimed")
      .order("created_at", { ascending: false })
      .limit(100)

    const giftCollection = (claimedGifts || []).map((gift: any) => {
      const value =
        gift.gift_value && typeof gift.gift_value === "object" ? gift.gift_value : {}
      const canonical = findCanonicalGift(
        value.canonical_id || gift.gift_name || gift.name,
      )
      const coinValue = giftCoinValue(gift)
      return {
        id: String(gift.id),
        name: gift.gift_name || gift.name || "Loop gift",
        type: gift.gift_type,
        rarity: gift.rarity || value.rarity || canonical?.rarity || "common",
        art: value.art || canonical?.art || null,
        palette: value.effects?.palette || canonical?.palette || null,
        use_type: value.use_type || canonical?.use || null,
        use_label: value.use_label || canonical?.useLabel || null,
        effect: value.effect || canonical?.effect || null,
        cost: Number(gift.cost || 0),
        coin_value: coinValue,
        converted_at: giftConvertedAt(gift),
        converted_coins: Number(value.converted_coins || 0) || null,
        context_type: gift.context_type || null,
        created_at: gift.created_at,
      }
    })

    return NextResponse.json({
      success: true,
      received: giftsReceived || [],
      sent: giftsSent || [],
      inventory: inventory || [],
      gift_collection: giftCollection,
    })
  } catch (error: any) {
    console.error("GET /api/wallet/gifts-history error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
