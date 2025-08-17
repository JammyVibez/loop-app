import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const offset = (page - 1) * limit

    let query = supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', user.id)
      .order('requested_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: withdrawals, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        withdrawals,
        page,
        limit,
        has_more: withdrawals?.length === limit
      }
    })

  } catch (error) {
    console.error("Get withdrawals error:", error)
    return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const body = await request.json()
    const { amount, method, method_details } = body

    // Validate input
    if (!amount || amount < 10) {
      return NextResponse.json({ 
        error: "Minimum withdrawal amount is $10" 
      }, { status: 400 })
    }

    if (!method || !['paypal', 'bank_transfer', 'crypto'].includes(method)) {
      return NextResponse.json({ 
        error: "Invalid withdrawal method" 
      }, { status: 400 })
    }

    if (!method_details) {
      return NextResponse.json({ 
        error: "Payment method details are required" 
      }, { status: 400 })
    }

    // Check user's available earnings
    const { data: profile } = await supabase
      .from('profiles')
      .select('available_earnings')
      .eq('id', user.id)
      .single()

    if (!profile || profile.available_earnings < amount) {
      return NextResponse.json({ 
        error: "Insufficient available earnings" 
      }, { status: 400 })
    }

    // Calculate fees (5% platform fee)
    const fees = Math.round(amount * 0.05 * 100) / 100
    const netAmount = amount - fees

    // Create withdrawal request
    const { data: withdrawal, error } = await supabase
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount,
        method,
        method_details,
        fees,
        net_amount: netAmount,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update user's available earnings
    await supabase
      .from('profiles')
      .update({ 
        available_earnings: profile.available_earnings - amount 
      })
      .eq('id', user.id)

    // Update earnings status to withdrawn
    await supabase
      .from('earnings')
      .update({ status: 'withdrawn' })
      .eq('user_id', user.id)
      .eq('status', 'available')
      .lte('amount', amount)

    return NextResponse.json({
      success: true,
      data: { withdrawal },
      message: "Withdrawal request submitted successfully"
    })

  } catch (error) {
    console.error("Create withdrawal error:", error)
    return NextResponse.json({ error: "Failed to create withdrawal request" }, { status: 500 })
  }
}
