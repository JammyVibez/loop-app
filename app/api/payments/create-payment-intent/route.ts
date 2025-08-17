import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function getUserFromToken(token: string) {
  try {
    const supabase = createServerClient()
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
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

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

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_secret_key')) {
      // Mock response for development
      return NextResponse.json({
        success: true,
        client_secret: "pi_mock_client_secret_" + Date.now(),
        payment_intent_id: "pi_mock_" + Date.now(),
        message: "Mock payment intent created. Configure STRIPE_SECRET_KEY in .env.local for real payments.",
        mock: true,
      })
    }

    // Initialize Stripe with real key
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    
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
    await supabase.from('payment_logs').insert({
      user_id: user.id,
      payment_intent_id: paymentIntent.id,
      amount: amount,
      currency: currency,
      status: 'created',
      metadata: metadata
    }).catch(console.error) // Don't fail if logging fails

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    })

  } catch (error) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json({
      error: "Failed to create payment intent",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 })
  }
}
