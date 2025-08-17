import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticketId')
    
    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this ticket
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('user_id')
      .eq('id', ticketId)
      .single()

    if (!ticket || ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get messages for the ticket
    const { data: messages, error } = await supabase
      .from('support_messages')
      .select(`
        *,
        user:profiles!support_messages_user_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error fetching support messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { ticketId, message } = await request.json()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this ticket
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('user_id, status')
      .eq('id', ticketId)
      .single()

    if (!ticket || ticket.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (ticket.status === 'closed') {
      return NextResponse.json({ error: 'Cannot send messages to closed tickets' }, { status: 400 })
    }

    // Create message
    const { data: newMessage, error: messageError } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        message: message,
        is_from_support: false
      })
      .select(`
        *,
        user:profiles!support_messages_user_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .single()

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 })
    }

    // Update ticket status to indicate user activity
    await supabase
      .from('support_tickets')
      .update({ 
        status: 'open',
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)

    // Notify support team
    const { data: supportUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_support', true)

    if (supportUsers && supportUsers.length > 0) {
      const supportNotifications = supportUsers.map(support => ({
        user_id: support.id,
        type: 'support_message',
        title: 'New Support Message',
        message: `User replied to ticket #${ticketId}`,
        data: { 
          ticket_id: ticketId,
          message_id: newMessage.id
        }
      }))

      await supabase
        .from('notifications')
        .insert(supportNotifications)
    }

    return NextResponse.json({ 
      success: true, 
      message: newMessage 
    })
  } catch (error) {
    console.error('Error sending support message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
