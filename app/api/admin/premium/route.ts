import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get current user and verify admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Fetch premium requests
    const { data: requests, error } = await supabase
      .from('premium_requests')
      .select(`
        *,
        user:profiles!premium_requests_user_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
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

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { requestId, action, adminNotes } = await request.json()
    
    // Get current user and verify admin status
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Update premium request
    const { data: premiumRequest, error: updateError } = await supabase
      .from('premium_requests')
      .update({
        status: action,
        admin_id: user.id,
        admin_notes: adminNotes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select('*, user:profiles!premium_requests_user_id_fkey(*)')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // If approved, update user profile and create subscription
    if (action === 'approved') {
      const expiresAt = new Date()
      if (premiumRequest.plan_type === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1)
      } else if (premiumRequest.plan_type === 'annual') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1)
      }

      // Update user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
          premium_expires_at: expiresAt.toISOString()
        })
        .eq('id', premiumRequest.user_id)

      if (profileError) {
        console.error('Error updating profile:', profileError)
      }

      // Create subscription record
      await supabase
        .from('subscriptions')
        .insert({
          user_id: premiumRequest.user_id,
          plan_type: premiumRequest.plan_type,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: expiresAt.toISOString(),
          amount: premiumRequest.amount
        })

      // Create notification for user
      await supabase
        .from('notifications')
        .insert({
          user_id: premiumRequest.user_id,
          type: 'premium_approved',
          title: 'Premium Approved!',
          message: `Your ${premiumRequest.plan_type} premium subscription has been activated.`,
          data: { plan_type: premiumRequest.plan_type, expires_at: expiresAt.toISOString() }
        })
    } else if (action === 'rejected') {
      // Create notification for rejection
      await supabase
        .from('notifications')
        .insert({
          user_id: premiumRequest.user_id,
          type: 'premium_rejected',
          title: 'Premium Request Rejected',
          message: `Your premium request has been rejected. ${adminNotes || ''}`,
          data: { plan_type: premiumRequest.plan_type, admin_notes: adminNotes }
        })
    }

    return NextResponse.json({ success: true, request: premiumRequest })
  } catch (error) {
    console.error('Error processing premium request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
