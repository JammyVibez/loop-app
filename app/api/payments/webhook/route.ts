import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log("Stripe not configured - webhook simulation mode")
      return NextResponse.json({
        received: true,
        message: "Webhook received (simulation mode)",
      })
    }

    // Dynamic import to avoid build-time errors
    const Stripe = (await import("stripe")).default

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    })

    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      return NextResponse.json({ error: "No signature provided" }, { status: 400 })
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.log("Webhook secret not configured - processing without verification")
      return NextResponse.json({
        received: true,
        message: "Webhook processed without verification",
      })
    }

    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
    const supabase = createServerClient()

    switch (event.type) {
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
