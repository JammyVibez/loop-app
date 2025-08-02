import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

// Use server-side env vars for API routes
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
})

async function getUserFromToken(token: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { item_id, payment_method } = await request.json()

    if (!item_id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 })
    }

    // Get shop item
    const { data: item, error: itemError } = await supabase
      .from("shop_items")
      .select("*")
      .eq("id", item_id)
      .eq("is_active", true)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loop_coins, is_premium")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
    }

    // Check if item requires premium
    if (item.premium_only && !profile.is_premium) {
      return NextResponse.json(
        {
          error: "Premium membership required for this item",
        },
        { status: 403 },
      )
    }

    // Check if user already owns this item
    const { data: existingPurchase } = await supabase
      .from("user_inventory")
      .select("id")
      .eq("user_id", user.id)
      .eq("item_id", item_id)
      .single()

    if (existingPurchase) {
      return NextResponse.json({ error: "Item already owned" }, { status: 400 })
    }

    if (payment_method === "coins") {
      // Pay with Loop Coins
      if (profile.loop_coins < item.price) {
        return NextResponse.json(
          {
            error: "Insufficient Loop Coins",
          },
          { status: 400 },
        )
      }

      // Deduct coins and add item to inventory
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ loop_coins: profile.loop_coins - item.price })
        .eq("id", user.id)

      if (updateError) {
        console.error("Error updating coins:", updateError)
        return NextResponse.json({ error: "Failed to process payment" }, { status: 500 })
      }

      // Add to inventory
      const { data: inventoryItem, error: inventoryError } = await supabase
        .from("user_inventory")
        .insert({
          user_id: user.id,
          item_id: item_id,
          purchased_at: new Date().toISOString(),
          purchase_price: item.price,
          payment_method: "coins",
        })
        .select()
        .single()

      if (inventoryError) {
        console.error("Error adding to inventory:", inventoryError)
        // Refund coins if inventory addition fails
        await supabase.from("profiles").update({ loop_coins: profile.loop_coins }).eq("id", user.id)
        return NextResponse.json({ error: "Failed to add item to inventory" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: "Item purchased successfully with Loop Coins",
        inventory_item: inventoryItem,
      })
    } else if (payment_method === "stripe") {
      // Pay with Stripe (for coin packages)
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(item.price * 100), // Convert to cents
          currency: "usd",
          metadata: {
            user_id: user.id,
            item_id: item_id,
            item_name: item.name,
          },
        })

        return NextResponse.json({
          success: true,
          client_secret: paymentIntent.client_secret,
          payment_intent_id: paymentIntent.id,
        })
      } catch (stripeError) {
        console.error("Stripe error:", stripeError)
        return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error processing purchase:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
