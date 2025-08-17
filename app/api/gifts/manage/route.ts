
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { gift_id, action, reason } = await request.json()
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    if (action === 'accept') {
      // Use the claim_gift function
      const { error } = await supabase.rpc('claim_gift', {
        p_gift_id: gift_id,
        p_user_id: user.id
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Gift accepted successfully!' 
      })

    } else if (action === 'decline') {
      // Use the decline_gift function
      const { error } = await supabase.rpc('decline_gift', {
        p_gift_id: gift_id,
        p_user_id: user.id,
        p_reason: reason || 'No reason provided'
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Gift declined and sender refunded.' 
      })

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error("Gift management error:", error)
    return NextResponse.json({ error: "Failed to process gift action" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'sent'
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get user's received gifts
    const { data: gifts, error } = await supabase
      .from('gifts')
      .select(`
        *,
        sender:profiles!gifts_sender_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('recipient_id', user.id)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { gifts }
    })

  } catch (error) {
    console.error("Get gifts error:", error)
    return NextResponse.json({ error: "Failed to fetch gifts" }, { status: 500 })
  }
}
