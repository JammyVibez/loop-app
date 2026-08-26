import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getStripeServer } from "@/lib/stripe-server"
import { getUserFromRequest } from "@/lib/server-auth";


export async function POST(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const { amount, currency = "usd", metadata, item_type } = await request.json()

    if (!amount || amount < 50) {
      return NextResponse.json(
        {
          error: "Amount must be at least $0.50",
        },
        { status: 400 },
      )
    }

    const stripe = await getStripeServer()
    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents
      currency: currency,
      metadata: {
        user_id: user.id,
        item_type: item_type || 'unknown',
        ...metadata
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // Log payment attempt
    const supabase = createServerClient()
    const { error: logError } = await supabase.from('payment_logs').insert({
      user_id: user.id,
      payment_intent_id: paymentIntent.id,
      amount: amount,
      currency: currency,
      status: 'created',
      metadata: metadata
    })
    if (logError) console.error("Payment log insert:", logError)

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    })

  } catch (error) {
    console.error("Error creating payment intent:", error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      error: "Failed to create payment intent",
      details: process.env.NODE_ENV === "development" ? message : undefined,
    }, { status: 500 })
  }
}
