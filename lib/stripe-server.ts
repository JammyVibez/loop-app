import type Stripe from "stripe"

/**
 * Lazy Stripe client for API routes. Never import `stripe` at module top level
 * so Next.js build-time route analysis does not instantiate Stripe without a key.
 */
export async function getStripeServer(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes("your_stripe")) {
    return null
  }
  const Stripe = (await import("stripe")).default
  return new Stripe(key, {
    apiVersion: "2023-10-16",
  })
}
