import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { planType, paymentMethod, amount } = await request.json()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has premium
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_premium, premium_expires_at')
      .eq('id', user.id)
      .single()

    if (profile?.is_premium && profile.premium_expires_at) {
      const expiresAt = new Date(profile.premium_expires_at)
      if (expiresAt > new Date()) {
        return NextResponse.json({ 
          error: 'You already have an active premium subscription' 
        }, { status: 400 })
      }
    }

    // Check if user already has a pending request
    const { data: existingRequest } = await supabase
      .from('premium_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (existingRequest) {
      return NextResponse.json({ 
        error: 'You already have a pending premium request' 
      }, { status: 400 })
    }

    // Create premium request
    const { data: premiumRequest, error } = await supabase
      .from('premium_requests')
      .insert({
        user_id: user.id,
        plan_type: planType,
        payment_method: paymentMethod,
        amount: amount,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create notification for admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('is_admin', true)

    if (admins && admins.length > 0) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      const adminNotifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'premium_request',
        title: 'New Premium Request',
        message: `${userProfile?.username || 'A user'} has submitted a ${planType} premium request for $${amount}.`,
        data: { 
          request_id: premiumRequest.id,
          username: userProfile?.username,
          plan_type: planType,
          amount: amount
        }
      }))

      await supabase
        .from('notifications')
        .insert(adminNotifications)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Premium request submitted successfully',
      request: premiumRequest 
    })
  } catch (error) {
    console.error('Error submitting premium request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's premium requests
    const { data: requests, error } = await supabase
      .from('premium_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Error fetching premium requests:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
