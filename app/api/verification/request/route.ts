import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserFromRequest } from "@/lib/server-auth";

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
    
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Required fields — the form enforces these, but so does the API so a
    // half-filled request can never land in the admin review queue.
    if (!realName?.trim() || !username?.trim() || !reason?.trim()) {
      return NextResponse.json(
        { error: 'Real name, username and reason are required' },
        { status: 400 },
      )
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
    const baseRow = {
      user_id: user.id,
      real_name: realName.trim(),
      username: username.trim().replace(/^@/, ''),
      social_links: socialLinks || null,
      reason: reason.trim(),
      verification_type: verificationType || null,
      documents_url: documents || null, // This would be a file URL after upload
      status: 'pending'
    }

    let { data: verificationRequest, error } = await supabase
      .from('verification_requests')
      .insert({ ...baseRow, category: verificationType || null })
      .select()
      .single()

    if (error && (error.code === '42703' || error.code === '23514')) {
      // Schema drift on older deployments: no `category` column, or a legacy
      // CHECK limiting verification_type to ('influencer','root'). Retry with
      // the base shape instead of failing the user's submission outright.
      const fallbackType = error.code === '23514' ? 'influencer' : (verificationType || null)
      ;({ data: verificationRequest, error } = await supabase
        .from('verification_requests')
        .insert({ ...baseRow, verification_type: fallbackType })
        .select()
        .single())
    }

    if (error) {
      console.error('Failed to insert verification request:', error)
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Verification is temporarily unavailable — the database migration is missing.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!verificationRequest) {
      return NextResponse.json({ error: 'Failed to submit verification request' }, { status: 500 })
    }

    // Create notification for admins
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true)

    if (!adminsError && admins && admins.length > 0) {
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
    
    const user = await getUserFromRequest(request);
    if (!user) {
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
