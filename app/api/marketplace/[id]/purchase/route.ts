import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

async function getAuthedUser(request: NextRequest) {
  const supabase = createServerClient()
  const user = await getUserFromRequest(request)
  if (!user) return null
  return user
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const supabase = createServerClient()

    const { data: listing, error: listingError } = await supabase
      .from("community_marketplace_listings")
      .select("*")
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle()

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: "You already own your own listing" }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from("community_marketplace_purchases")
      .select("id")
      .eq("listing_id", id)
      .eq("buyer_id", user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, already_owned: true })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const price = listing.price_coins || 0
    if (profile.loop_coins < price) {
      return NextResponse.json({ error: "Insufficient Loop Coins" }, { status: 400 })
    }

    if (price > 0) {
      const { error: deductError } = await supabase
        .from("profiles")
        .update({ loop_coins: profile.loop_coins - price, updated_at: new Date().toISOString() })
        .eq("id", user.id)

      if (deductError) {
        return NextResponse.json({ error: "Failed to deduct coins" }, { status: 500 })
      }

      if (listing.seller_id) {
        const { data: seller } = await supabase
          .from("profiles")
          .select("loop_coins")
          .eq("id", listing.seller_id)
          .maybeSingle()

        if (seller) {
          const sellerCut = Math.floor(price * 0.85)
          await supabase
            .from("profiles")
            .update({
              loop_coins: (seller.loop_coins || 0) + sellerCut,
              updated_at: new Date().toISOString(),
            })
            .eq("id", listing.seller_id)
        }
      }
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from("community_marketplace_purchases")
      .insert({
        listing_id: id,
        buyer_id: user.id,
        price_paid: price,
      })
      .select("*")
      .single()

    if (purchaseError) {
      console.error("Purchase insert error:", purchaseError)
      return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 })
    }

    await supabase
      .from("community_marketplace_listings")
      .update({
        sales_count: (listing.sales_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    const { error: notifyError } = await supabase.from("notifications").insert({
      user_id: user.id,
      type: "marketplace_purchase",
      title: "Marketplace purchase",
      message: `You unlocked “${listing.title}” for ${price} Loop Coins`,
      data: { listing_id: id, listing_type: listing.listing_type },
    })
    if (notifyError) {
      console.warn("Marketplace purchase notification skipped:", notifyError.message)
    }

    return NextResponse.json({
      success: true,
      purchase,
      remaining_coins: profile.loop_coins - price,
    })
  } catch (error) {
    console.error("Marketplace purchase error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
