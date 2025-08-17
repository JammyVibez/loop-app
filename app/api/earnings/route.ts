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
    const source_type = searchParams.get('source_type')
    const offset = (page - 1) * limit

    // Get user's earnings
    let query = supabase
      .from('earnings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (source_type) {
      query = query.eq('source_type', source_type)
    }

    const { data: earnings, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get earnings summary
    const { data: summary } = await supabase
      .from('profiles')
      .select('total_earnings, available_earnings')
      .eq('id', user.id)
      .single()

    // Get earnings by status
    const { data: statusBreakdown } = await supabase
      .from('earnings')
      .select('status, amount.sum()')
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      data: {
        earnings,
        summary: summary || { total_earnings: 0, available_earnings: 0 },
        breakdown: statusBreakdown || [],
        page,
        limit,
        has_more: earnings?.length === limit
      }
    })

  } catch (error) {
    console.error("Get earnings error:", error)
    return NextResponse.json({ error: "Failed to fetch earnings" }, { status: 500 })
  }
}
