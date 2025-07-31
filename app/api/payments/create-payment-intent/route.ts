import { type NextRequest, NextResponse } from "next/server"

// NOTE: Add your Stripe secret key to .env.local
// STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here

export async function POST(request: NextRequest) {
  try {
    const { amount, currency = "usd", metadata } = await request.json()

    if (!amount || amount < 50) {
      return NextResponse.json(
        {
          error: "Amount must be at least $0.50",
        },
        { status: 400 },
      )
    }

    // Initialize Stripe (uncomment when you add your secret key)
    /*
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // Amount in cents
      currency: currency,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    })
    */

    // Mock response for development
    return NextResponse.json({
      success: true,
      client_secret: "pi_mock_client_secret_" + Date.now(),
      payment_intent_id: "pi_mock_" + Date.now(),
      message: "Mock payment intent created. Add STRIPE_SECRET_KEY to .env.local for real payments.",
    })
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 })
  }
}
