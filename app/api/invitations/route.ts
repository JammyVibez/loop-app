import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's invitations (both sent and received)
    const { data: receivedInvitations, error: receivedError } = await supabase
      .from('invitations')
      .select(`
        *,
        inviter:profiles!invitations_inviter_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        circle:circles(
          id,
          name,
          description
        )
      `)
      .eq('invitee_id', user.id)
      .order('created_at', { ascending: false })

    const { data: sentInvitations, error: sentError } = await supabase
      .from('invitations')
      .select(`
        *,
        invitee:profiles!invitations_invitee_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        circle:circles(
          id,
          name,
          description
        )
      `)
      .eq('inviter_id', user.id)
      .order('created_at', { ascending: false })

    if (receivedError || sentError) {
      return NextResponse.json({ 
        error: receivedError?.message || sentError?.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      received: receivedInvitations || [],
      sent: sentInvitations || []
    })
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { 
      inviteeId, 
      inviteeEmail, 
      inviteeUsername,
      type, 
      resourceId, 
      message,
      permissions 
    } = await request.json()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let targetUserId = inviteeId

    // If inviting by email or username, find the user
    if (!targetUserId && (inviteeEmail || inviteeUsername)) {
      const { data: targetUser } = await supabase
        .from('profiles')
        .select('id')
        .or(`email.eq.${inviteeEmail},username.eq.${inviteeUsername}`)
        .single()

      if (!targetUser) {
        return NextResponse.json({ 
          error: 'User not found' 
        }, { status: 404 })
      }

      targetUserId = targetUser.id
    }

    if (!targetUserId) {
      return NextResponse.json({ 
        error: 'Invalid invitation target' 
      }, { status: 400 })
    }

    // Check if invitation already exists
    const { data: existingInvitation } = await supabase
      .from('invitations')
      .select('id')
      .eq('inviter_id', user.id)
      .eq('invitee_id', targetUserId)
      .eq('type', type)
      .eq('resource_id', resourceId)
      .eq('status', 'pending')
      .single()

    if (existingInvitation) {
      return NextResponse.json({ 
        error: 'Invitation already sent' 
      }, { status: 400 })
    }

    // Create invitation
    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        inviter_id: user.id,
        invitee_id: targetUserId,
        type: type,
        resource_id: resourceId,
        message: message || '',
        permissions: permissions || {},
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      })
      .select(`
        *,
        inviter:profiles!invitations_inviter_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        invitee:profiles!invitations_invitee_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create notification for invitee
    await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        type: 'invitation',
        title: 'New Invitation',
        message: `${invitation.inviter.display_name} invited you to collaborate`,
        data: { 
          invitation_id: invitation.id,
          type: type,
          resource_id: resourceId
        }
      })

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      invitation 
    })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
