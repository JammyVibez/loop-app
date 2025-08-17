import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient()
    const { action } = await request.json() // 'accept' or 'decline'
    const invitationId = params.id
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get invitation details
    const { data: invitation, error: invitationError } = await supabase
      .from('invitations')
      .select(`
        *,
        inviter:profiles!invitations_inviter_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('id', invitationId)
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .single()

    if (invitationError || !invitation) {
      return NextResponse.json({ 
        error: 'Invitation not found or already processed' 
      }, { status: 404 })
    }

    // Check if invitation has expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId)

      return NextResponse.json({ 
        error: 'Invitation has expired' 
      }, { status: 400 })
    }

    // Update invitation status
    const newStatus = action === 'accept' ? 'accepted' : 'declined'
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ 
        status: newStatus,
        responded_at: new Date().toISOString()
      })
      .eq('id', invitationId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // If accepted, perform the appropriate action based on invitation type
    if (action === 'accept') {
      switch (invitation.type) {
        case 'circle_collaboration':
          // Add user to circle as member
          await supabase
            .from('circle_members')
            .insert({
              circle_id: invitation.resource_id,
              user_id: user.id,
              role: invitation.permissions?.role || 'member',
              joined_at: new Date().toISOString()
            })
          break

        case 'loop_collaboration':
          // Add user as loop collaborator
          await supabase
            .from('loop_collaborators')
            .insert({
              loop_id: invitation.resource_id,
              user_id: user.id,
              role: invitation.permissions?.role || 'contributor',
              permissions: invitation.permissions || { read: true, write: true },
              joined_at: new Date().toISOString()
            })
          break

        case 'project_collaboration':
          // Add user as project collaborator
          await supabase
            .from('project_collaborators')
            .insert({
              project_id: invitation.resource_id,
              user_id: user.id,
              role: invitation.permissions?.role || 'contributor',
              permissions: invitation.permissions || { read: true, write: false },
              joined_at: new Date().toISOString()
            })
          break
      }
    }

    // Create notification for inviter
    await supabase
      .from('notifications')
      .insert({
        user_id: invitation.inviter_id,
        type: 'invitation_response',
        title: `Invitation ${action}ed`,
        message: `${user.email} ${action}ed your collaboration invitation`,
        data: { 
          invitation_id: invitationId,
          action: action,
          type: invitation.type,
          resource_id: invitation.resource_id
        }
      })

    return NextResponse.json({ 
      success: true, 
      message: `Invitation ${action}ed successfully`,
      status: newStatus
    })
  } catch (error) {
    console.error('Error responding to invitation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
