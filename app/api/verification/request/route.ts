import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { 
      realName, 
      username, 
      socialLinks, 
      reason, 
      verificationType, 
      documents 
    } = await request.json()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has a pending request
    const { data: existingRequest } = await supabase
      .from('verification_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single()

    if (existingRequest) {
      return NextResponse.json({ 
        error: 'You already have a pending verification request' 
      }, { status: 400 })
    }

    // Check if user is already verified
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_verified')
      .eq('id', user.id)
      .single()

    if (profile?.is_verified) {
      return NextResponse.json({ 
        error: 'You are already verified' 
      }, { status: 400 })
    }

    // Create verification request
    const { data: verificationRequest, error } = await supabase
      .from('verification_requests')
      .insert({
        user_id: user.id,
        real_name: realName,
        username: username,
        social_links: socialLinks,
        reason: reason,
        verification_type: verificationType,
        documents_url: documents, // This would be a file URL after upload
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
      .select('id')
      .eq('is_admin', true)

    if (admins && admins.length > 0) {
      const adminNotifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'verification_request',
        title: 'New Verification Request',
        message: `${username} has submitted a ${verificationType} verification request.`,
        data: { 
          request_id: verificationRequest.id,
          username: username,
          verification_type: verificationType 
        }
      }))

      await supabase
        .from('notifications')
        .insert(adminNotifications)
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Verification request submitted successfully',
      request: verificationRequest 
    })
  } catch (error) {
    console.error('Error submitting verification request:', error)
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

    // Get user's verification requests
    const { data: requests, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', user.id)
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
