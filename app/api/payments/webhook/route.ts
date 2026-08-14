import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { notifyUser } from "@/lib/notifications"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("your_stripe_secret_key")) {
      const status = process.env.NODE_ENV === "production" ? 503 : 200
      return NextResponse.json(
        { received: false, message: "Stripe is not configured" },
        { status },
      )
    }

    // Dynamic import to avoid build-time errors
    const Stripe = (await import("stripe")).default

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Always use the API version pinned by the installed stripe package.
      apiVersion: Stripe.API_VERSION,
    })

    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      return NextResponse.json({ error: "No signature provided" }, { status: 400 })
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET.includes("your_webhook_secret")) {
      const status = process.env.NODE_ENV === "production" ? 503 : 400
      return NextResponse.json(
        { error: "Stripe webhook secret is not configured" },
        { status },
      )
    }

    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
    const supabase = createServerClient()

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any
        const metadata = session.metadata || {}

        if (metadata.kind === "premium" && metadata.user_id) {
          const userId = String(metadata.user_id)
          const days = Math.max(1, Number(metadata.plan_days) || 30)
          const txId = `stripe_${session.id}`

          // Idempotency: never double-grant on webhook retries.
          const { data: existingTx } = await supabase
            .from("wallet_transactions")
            .select("id")
            .eq("id", txId)
            .maybeSingle()

          if (existingTx) {
            console.log(`Premium checkout ${session.id} already granted, skipping`)
            break
          }

          if (session.payment_status !== "paid") {
            console.warn(`Premium checkout ${session.id} completed but payment_status=${session.payment_status}`)
            break
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("premium_expires_at")
            .eq("id", userId)
            .maybeSingle()

          const now = new Date()
          const currentExpiry =
            profile?.premium_expires_at && new Date(profile.premium_expires_at) > now
              ? new Date(profile.premium_expires_at)
              : now
          const expiresAt = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000)

          const { error: grantError } = await supabase
            .from("profiles")
            .update({
              is_premium: true,
              premium_expires_at: expiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", userId)

          if (grantError) {
            console.error("Failed to grant premium from checkout session:", grantError)
            break
          }

          const amountUsd = typeof session.amount_total === "number" ? session.amount_total / 100 : 0

          await supabase.from("wallet_transactions").insert({
            id: txId,
            user_id: userId,
            amount_usd: amountUsd,
            coins_amount: 0,
            type: "premium_purchase",
            description: `Loop Pro (${days} days)`,
            status: "completed",
            payment_method: "stripe",
            payment_intent_id: session.payment_intent || null,
            created_at: new Date().toISOString(),
          })

          await notifyUser(supabase, {
            userId,
            type: "system",
            title: "Welcome to Loop Pro! 👑",
            message: `Your Pro membership is active until ${expiresAt.toLocaleDateString()}.`,
            data: { plan: metadata.plan, premium_expires_at: expiresAt.toISOString() },
            actionUrl: "/lounge",
          })
          break
        }

        if (metadata.kind === "shop_item" && metadata.user_id && metadata.item_id) {
          const userId = String(metadata.user_id)
          const itemId = String(metadata.item_id)
          const itemType = String(metadata.item_type || "item")
          const txId = `stripe_${session.id}`

          if (session.payment_status !== "paid") {
            console.warn(`Shop checkout ${session.id} completed but payment_status=${session.payment_status}`)
            break
          }

          const { data: existingTx } = await supabase
            .from("wallet_transactions")
            .select("id")
            .eq("id", txId)
            .maybeSingle()

          if (existingTx) {
            console.log(`Shop checkout ${session.id} already granted, skipping`)
            break
          }

          const { error: inventoryError } = await supabase.from("user_inventory").upsert(
            {
              user_id: userId,
              item_id: itemId,
              item_type: itemType,
              is_active: false,
              purchased_at: new Date().toISOString(),
              payment_method: "stripe",
            },
            { onConflict: "user_id,item_id" },
          )

          if (inventoryError) {
            console.error("Failed to grant shop item from checkout session:", inventoryError)
            break
          }

          const amountUsd = typeof session.amount_total === "number" ? session.amount_total / 100 : 0

          await supabase.from("wallet_transactions").insert({
            id: txId,
            user_id: userId,
            amount_usd: amountUsd,
            coins_amount: 0,
            type: "shop_purchase",
            description: `Purchased ${metadata.item_name || "Shop item"}`,
            status: "completed",
            payment_method: "stripe",
            payment_intent_id: session.payment_intent || null,
            item_id: metadata.item_id || null,
            created_at: new Date().toISOString(),
          })

          await notifyUser(supabase, {
            userId,
            type: "system",
            title: "Purchase complete! 🛍️",
            message: `“${metadata.item_name || "Your item"}” is now in your inventory.`,
            data: { item_id: itemId },
            actionUrl: "/inventory",
          })
          break
        }

        if (metadata.kind === "coin_pack" && metadata.user_id && metadata.coins_amount) {
          const userId = String(metadata.user_id)
          const coinsToAdd = Number(metadata.coins_amount) || 0
          const txId = `stripe_${session.id}`

          // Idempotency: Stripe may retry webhook delivery — never double-credit.
          const { data: existingTx } = await supabase
            .from("wallet_transactions")
            .select("id")
            .eq("id", txId)
            .maybeSingle()

          if (existingTx) {
            console.log(`Checkout session ${session.id} already credited, skipping`)
            break
          }

          if (session.payment_status !== "paid") {
            console.warn(`Checkout session ${session.id} completed but payment_status=${session.payment_status}`)
            break
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("loop_coins")
            .eq("id", userId)
            .maybeSingle()

          const currentCoins = Number(profile?.loop_coins || 0)
          const newBalance = currentCoins + coinsToAdd

          const { error: creditError } = await supabase
            .from("profiles")
            .upsert({ id: userId, loop_coins: newBalance, updated_at: new Date().toISOString() })

          if (creditError) {
            console.error("Failed to credit loop_coins from checkout session:", creditError)
            break
          }

          const amountUsd = typeof session.amount_total === "number" ? session.amount_total / 100 : 0

          await supabase.from("wallet_transactions").insert({
            id: txId,
            user_id: userId,
            amount_usd: amountUsd,
            coins_amount: coinsToAdd,
            type: "deposit",
            description: `Purchased ${coinsToAdd.toLocaleString()} Loop Coins`,
            status: "completed",
            payment_method: "stripe",
            payment_intent_id: session.payment_intent || null,
            item_id: metadata.item_id || null,
            created_at: new Date().toISOString(),
          })

          if (metadata.item_id) {
            const { data: item } = await supabase
              .from("shop_items")
              .select("purchase_count")
              .eq("id", metadata.item_id)
              .maybeSingle()
            await supabase
              .from("shop_items")
              .update({ purchase_count: Number(item?.purchase_count || 0) + 1 })
              .eq("id", metadata.item_id)
          }

          await notifyUser(supabase, {
            userId,
            type: "system",
            title: "Coins added! 🎉",
            message: `${coinsToAdd.toLocaleString()} Loop Coins were added to your wallet.`,
            data: { coins_amount: coinsToAdd },
            actionUrl: "/wallet",
          })
        }
        break
      }
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object as any
        await supabase
          .from("payment_logs")
          .update({ status: "succeeded" })
          .eq("payment_intent_id", paymentIntent.id)

        if (paymentIntent.metadata?.user_id && paymentIntent.metadata?.item_type === "premium") {
          const expiryDate = new Date()
          expiryDate.setMonth(expiryDate.getMonth() + 1)
          await supabase
            .from("profiles")
            .update({
              is_premium: true,
              premium_expires_at: expiryDate.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentIntent.metadata.user_id)
        }

        if (paymentIntent.metadata?.user_id && paymentIntent.metadata?.item_id) {
          await supabase.from("user_inventory").upsert({
            user_id: paymentIntent.metadata.user_id,
            item_id: paymentIntent.metadata.item_id,
            acquired_at: new Date().toISOString(),
            source: "stripe",
          })
        }
        break
      case "customer.subscription.created":
        console.log("Subscription created:", event.data.object.id)
        break
      case "customer.subscription.updated":
        console.log("Subscription updated:", event.data.object.id)
        break
      case "customer.subscription.deleted":
        console.log("Subscription cancelled:", event.data.object.id)
        break
      case "payment_intent.payment_failed":
        const failedIntent = event.data.object as any
        await supabase
          .from("payment_logs")
          .update({ status: "failed" })
          .eq("payment_intent_id", failedIntent.id)
        break
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 })
  }
}

// Handle GET requests for webhook endpoint verification
export async function GET() {
  return NextResponse.json({
    message: "Stripe webhook endpoint is active",
    timestamp: new Date().toISOString(),
  })
}
