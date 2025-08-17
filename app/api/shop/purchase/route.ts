import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { item_id, payment_method } = await request.json()
    const supabase = createClient()
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    // Get item details
    const { data: item, error: itemError } = await supabase
      .from('shop_items')
      .select('*')
      .eq('id', item_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 })
    }

    // Check if user already owns this item
    const { data: existingItem, error: existingError } = await supabase
      .from('user_inventory')
      .select('*')
      .eq('user_id', user.id)
      .eq('item_id', item_id)
      .single()

    if (existingItem) {
      return NextResponse.json({ success: false, error: 'Item already owned' }, { status: 400 })
    }

    if (payment_method === 'coins') {
      // Handle coin payment
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('loop_coins, is_premium')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
      }

      // Check premium requirement
      if (item.premium_only && !profile.is_premium) {
        return NextResponse.json({ success: false, error: 'Premium membership required' }, { status: 403 })
      }

      if (profile.loop_coins < item.price_coins) {
        return NextResponse.json({ success: false, error: 'Insufficient coins' }, { status: 400 })
      }

      // Deduct coins
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ loop_coins: profile.loop_coins - item.price_coins })
        .eq('id', user.id)

      if (deductError) {
        return NextResponse.json({ success: false, error: 'Failed to deduct coins' }, { status: 500 })
      }

      // Add to inventory
      const { error: inventoryError } = await supabase
        .from('user_inventory')
        .insert({
          user_id: user.id,
          item_id: item_id,
          quantity: 1
        })

      if (inventoryError) {
        return NextResponse.json({ success: false, error: 'Failed to add to inventory' }, { status: 500 })
      }

      // Handle special items
      if (item.category === 'premium') {
        // Grant premium subscription
        const duration = item.item_data?.duration
        let premiumUntil = new Date()
        
        if (duration === '1 month') {
          premiumUntil.setMonth(premiumUntil.getMonth() + 1)
        } else if (duration === '1 year') {
          premiumUntil.setFullYear(premiumUntil.getFullYear() + 1)
        }

        await supabase
          .from('profiles')
          .update({ 
            is_premium: true,
            premium_until: premiumUntil.toISOString()
          })
          .eq('id', user.id)
      } else if (item.category === 'coins') {
        // Add bonus coins
        const coinAmount = item.item_data?.coin_amount || 0
        const bonusAmount = item.item_data?.bonus || 0
        const totalCoins = coinAmount + bonusAmount

        await supabase
          .from('profiles')
          .update({ 
            loop_coins: profile.loop_coins - item.price_coins + totalCoins
          })
          .eq('id', user.id)
      } else if (item.category === 'theme') {
        // Add theme to user themes
        await supabase
          .from('user_themes')
          .insert({
            user_id: user.id,
            theme_id: item.item_data?.theme_id || item.id
          })
      }

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          type: 'purchase_success',
          title: 'Purchase Successful!',
          message: `You purchased ${item.name} for ${item.price_coins} Loop Coins`,
          data: { item_id, item_name: item.name }
        })

      return NextResponse.json({ success: true })
    } else if (payment_method === 'stripe') {
      // Handle Stripe payment for USD purchases
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
      
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(item.price_usd * 100), // Convert to cents
          currency: 'usd',
          metadata: {
            user_id: user.id,
            item_id: item_id,
            item_name: item.name
          }
        })

        return NextResponse.json({ 
          success: true, 
          client_secret: paymentIntent.client_secret 
        })
      } catch (stripeError) {
        console.error('Stripe error:', stripeError)
        return NextResponse.json({ success: false, error: 'Payment processing failed' }, { status: 500 })
      }
    } else {
      return NextResponse.json({ success: false, error: 'Invalid payment method' }, { status: 400 })
    }
  } catch (error) {
    console.error('Purchase error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
