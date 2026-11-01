import type Stripe from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

function epochToIso(value: number | null | undefined): string | null {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null
}

/**
 * Synchronises recurring Premium state from a verified Stripe subscription.
 * Webhook retries and checkout confirmation share this path so subscription
 * records and profile entitlement stay consistent.
 */
export async function syncStripePremiumSubscription(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
) {
  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle()

  if (existingError) throw existingError

  const userId = subscription.metadata?.user_id || existing?.user_id
  if (!userId) throw new Error("Stripe subscription is missing its LOOP account reference")

  const price = subscription.items.data[0]?.price
  const interval = price?.recurring?.interval
  const planType = subscription.metadata?.plan === "annual" || interval === "year"
    ? "annual"
    : "monthly"
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id
  const currentPeriodStart = epochToIso(subscription.current_period_start)
  const currentPeriodEnd = epochToIso(subscription.current_period_end)
  const canceledAt = epochToIso(subscription.canceled_at)
  const amount = typeof price?.unit_amount === "number" ? price.unit_amount / 100 : 0
  const now = new Date().toISOString()

  const { error: upsertError } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_type: planType,
      status: subscription.status,
      source: "stripe",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price?.id || null,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      canceled_at: canceledAt,
      amount,
      currency: price?.currency || "usd",
      metadata: {
        ...subscription.metadata,
        stripe_subscription_status: subscription.status,
      },
      updated_at: now,
    },
    { onConflict: "stripe_subscription_id" },
  )
  if (upsertError) throw upsertError

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_premium, premium_source, premium_expires_at")
    .eq("id", userId)
    .maybeSingle()

  if (profileError) throw profileError
  if (!profile) throw new Error("Premium account profile was not found")

  const { data: activeSubscriptions, error: activeError } = await supabase
    .from("subscriptions")
    .select("current_period_end")
    .eq("user_id", userId)
    .eq("source", "stripe")
    .in("status", ["active", "trialing"])
    .gt("current_period_end", now)

  if (activeError) throw activeError

  const nowMs = Date.now()
  const existingExpiryMs = profile.premium_expires_at
    ? new Date(profile.premium_expires_at).getTime()
    : Number.POSITIVE_INFINITY
  const keepNonStripeAccess =
    Boolean(profile.is_premium) &&
    profile.premium_source !== "stripe" &&
    existingExpiryMs > nowMs

  const stripeExpiry = (activeSubscriptions || [])
    .map((row) => row.current_period_end ? new Date(row.current_period_end).getTime() : 0)
    .filter((value) => value > nowMs)
    .sort((left, right) => right - left)[0]

  const hasStripeAccess = Boolean(stripeExpiry)
  const isPremium = keepNonStripeAccess || hasStripeAccess
  const premiumSource = keepNonStripeAccess
    ? profile.premium_source || "legacy"
    : hasStripeAccess
      ? "stripe"
      : null
  const premiumExpiresAt = keepNonStripeAccess
    ? profile.premium_expires_at
    : stripeExpiry
      ? new Date(stripeExpiry).toISOString()
      : null

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      is_premium: isPremium,
      premium_source: premiumSource,
      premium_expires_at: premiumExpiresAt,
      updated_at: now,
    })
    .eq("id", userId)

  if (profileUpdateError) throw profileUpdateError

  return {
    userId,
    active: isPremium,
    planType,
    status: subscription.status,
    currentPeriodEnd,
  }
}
