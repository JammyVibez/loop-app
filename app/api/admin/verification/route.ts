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

    // Fetch verification requests
    const { data: requests, error } = await supabase
      .from('verification_requests')
      .select(`
        *,
        user:profiles!verification_requests_user_id_fkey(
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
    console.error('Error fetching verification requests:', error)
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

    // Update verification request
    const { data: request, error: updateError } = await supabase
      .from('verification_requests')
      .update({
        status: action,
        admin_id: user.id,
        admin_notes: adminNotes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select('*, user:profiles!verification_requests_user_id_fkey(*)')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // If approved, update user profile
    if (action === 'approved') {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_verified: true,
          verification_level: request.verification_type,
          verified_at: new Date().toISOString()
        })
        .eq('id', request.user_id)

      if (profileError) {
        console.error('Error updating profile:', profileError)
      }

      // Create notification for user
      await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          type: 'verification_approved',
          title: 'Verification Approved!',
          message: `Your ${request.verification_type} verification has been approved.`,
          data: { verification_type: request.verification_type }
        })
    } else if (action === 'rejected') {
      // Create notification for rejection
      await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          type: 'verification_rejected',
          title: 'Verification Request Rejected',
          message: `Your verification request has been rejected. ${adminNotes || ''}`,
          data: { verification_type: request.verification_type, admin_notes: adminNotes }
        })
    }

    return NextResponse.json({ success: true, request })
  } catch (error) {
    console.error('Error processing verification request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
