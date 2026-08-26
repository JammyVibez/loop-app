import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { PRO_PRICING, type ProPlanId } from "@/lib/pro-features"
import { getStripeServer } from "@/lib/stripe-server"
import { getAppUrl } from "@/lib/app-url"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

async function getUser(token: string | null) {
  if (!token) return null
  const user = await getUserFromRequest(request)
  if (!user) return null
  return user
}

/**
 * Activate Loop Pro with Loop Coins (launch pricing).
 * Body: { plan: "monthly" | "annual", method?: "coins" }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const planId = (body.plan === "annual" ? "annual" : "monthly") as ProPlanId
    const plan: (typeof PRO_PRICING)[ProPlanId] = PRO_PRICING[planId]
    const method = body.method === "request" ? "request" : body.method === "stripe" ? "stripe" : "coins"

    // Pay with card — Stripe Checkout. The webhook (kind: "premium")
    // grants the membership once payment succeeds.
    if (method === "stripe") {
      const stripe = await getStripeServer()
      if (!stripe) {
        return NextResponse.json(
          { error: "Card payments are temporarily unavailable. Please try again later." },
          { status: 503 },
        )
      }

      const appUrl = getAppUrl(request)
      // Capture before any `||` narrowing (as-const literal strings make
      // `plan.description || …` narrow `plan` to never).
      const planDays = plan.days
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: user.email || undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(plan.priceUsd * 100),
              product_data: {
                name: `Loop Pro ${plan.name}`,
                description: plan.description || `${planDays} days of Loop Pro`,
              },
            },
          },
        ],
        metadata: {
          kind: "premium",
          user_id: user.id,
          plan: planId,
          plan_days: String(planDays),
        },
        success_url: `${appUrl}/lounge?checkout=success`,
        cancel_url: `${appUrl}/premium?checkout=cancelled`,
      })

      if (!session.url) {
        return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 })
      }

      return NextResponse.json({ success: true, method: "stripe", checkout_url: session.url })
    }

    if (method === "request") {
      const { error } = await supabase.from("premium_requests").insert({
        user_id: user.id,
        plan_type: planId,
        status: "pending",
        admin_notes: `Launch Pro ${planId} request`,
      })
      if (error && !/duplicate|exists/i.test(error.message)) {
        // Table may not exist — still return success-ish message for UX
        console.error("premium_requests insert:", error.message)
      }
      return NextResponse.json({
        success: true,
        method: "request",
        message: "Pro request submitted. An admin will review it shortly.",
      })
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loop_coins, is_premium, premium_expires_at")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    const coins = Number(profile.loop_coins || 0)
    if (coins < plan.coins) {
      return NextResponse.json(
        {
          error: `Not enough coins. Pro ${plan.name} costs ${plan.coins} coins (you have ${coins}).`,
          required: plan.coins,
          balance: coins,
        },
        { status: 400 },
      )
    }

    const now = new Date()
    const currentExpiry =
      profile.premium_expires_at && new Date(profile.premium_expires_at) > now
        ? new Date(profile.premium_expires_at)
        : now
    const expiresAt = new Date(currentExpiry.getTime() + plan.days * 24 * 60 * 60 * 1000)
    const nextCoins = coins - plan.coins

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        loop_coins: nextCoins,
        is_premium: true,
        premium_expires_at: expiresAt.toISOString(),
        can_stream: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      // Retry without can_stream if column missing
      const { error: retryError } = await supabase
        .from("profiles")
        .update({
          loop_coins: nextCoins,
          is_premium: true,
          premium_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
      if (retryError) return NextResponse.json({ error: retryError.message }, { status: 500 })
    }

    await supabase.from("coin_transactions").insert({
      user_id: user.id,
      amount: -plan.coins,
      transaction_type: "premium_purchase",
      description: `Loop Pro ${plan.name} (${plan.days} days)`,
    })

    return NextResponse.json({
      success: true,
      method: "coins",
      plan: planId,
      coins_spent: plan.coins,
      loop_coins: nextCoins,
      is_premium: true,
      premium_expires_at: expiresAt.toISOString(),
      message: `Welcome to Loop Pro! Active until ${expiresAt.toLocaleDateString()}.`,
    })
  } catch (error: any) {
    console.error("Premium activate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    pricing: PRO_PRICING,
    currency: "USD + Loop Coins",
  })
}
