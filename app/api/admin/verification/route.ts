import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getUserFromRequest } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    const user = await getUserFromRequest(request);
    if (!user) {
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
          avatar_url,
          is_verified
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
    const body = (await request.json()) as {
      requestId: string
      action: string
      adminNotes?: string
    }
    const { requestId, action, adminNotes } = body

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }
    if (action !== 'approved' && action !== 'rejected') {
      return NextResponse.json({ error: "action must be 'approved' or 'rejected'" }, { status: 400 })
    }
    if (action === 'rejected' && !adminNotes?.trim()) {
      return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
    }
    
    const user = await getUserFromRequest(request);
    if (!user) {
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
    const { data: verificationRequest, error: updateError } = await supabase
      .from('verification_requests')
      .update({
        status: action,
        admin_id: user.id,
        reviewed_by: user.id,
        admin_notes: adminNotes || null,
        rejection_reason: action === 'rejected' ? (adminNotes || null) : null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*, user:profiles!verification_requests_user_id_fkey(*)')
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // If approved, update the user's profile.
    //
    // `profiles.verification_level` has a closed set of allowed values
    // (none/basic/influencer/root) while requests carry types like
    // "creator"/"business"/"public_figure"/"nonprofit". Writing the raw
    // request type violated the CHECK constraint and the entire update
    // silently failed — the request showed "approved" but the user never
    // became verified. Map to an allowed level and fall back through safer
    // patches so `is_verified` always lands.
    if (action === 'approved' && verificationRequest) {
      const rawType = String(verificationRequest.verification_type || '')
      const mappedLevel = rawType === 'root'
        ? 'root'
        : rawType === 'influencer'
          ? 'influencer'
          : 'basic'
      const verifiedAt = new Date().toISOString()
      const attempts: Array<Record<string, unknown>> = [
        { is_verified: true, verification_level: mappedLevel, verified_at: verifiedAt },
        { is_verified: true, verification_level: mappedLevel },
        { is_verified: true, verified_at: verifiedAt },
        { is_verified: true },
      ]

      let lastProfileError: string | null = null
      for (const patch of attempts) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(patch)
          .eq('id', verificationRequest.user_id)
        if (!profileError) {
          lastProfileError = null
          break
        }
        lastProfileError = profileError.message
      }

      if (lastProfileError) {
        // Never leave an approved request unverified silently — surface it.
        console.error('Could not mark user as verified:', lastProfileError)
      }

      // Create notification for user
      await supabase
        .from('notifications')
        .insert({
          user_id: verificationRequest.user_id,
          type: 'verification_approved',
          title: 'Verification Approved!',
          message: `Your ${verificationRequest.verification_type} verification has been approved.`,
          data: { verification_type: verificationRequest.verification_type }
        })
    } else if (action === 'rejected') {
      // Create notification for rejection
      await supabase
        .from('notifications')
        .insert({
          user_id: verificationRequest.user_id,
          type: 'verification_rejected',
          title: 'Verification Request Rejected',
          message: `Your verification request has been rejected. ${adminNotes || ''}`,
          data: { verification_type: verificationRequest.verification_type, admin_notes: adminNotes }
        })
    }

    return NextResponse.json({ success: true, request: verificationRequest })
  } catch (error) {
    console.error('Error processing verification request:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
