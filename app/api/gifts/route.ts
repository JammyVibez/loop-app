import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    
    const rarity = searchParams.get('rarity')
    const active_only = searchParams.get('active_only') !== 'false'

    let query = supabase
      .from('gifts')
      .select('*')
      .order('price_coins', { ascending: true })

    if (rarity) {
      query = query.eq('rarity', rarity)
    }

    if (active_only) {
      query = query.eq('is_active', true)
    }

    const { data: gifts, error } = await query

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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, icon_url, animation_url, price_coins, rarity, effects } = body

    if (!name?.trim() || !description?.trim() || !icon_url || price_coins < 1) {
      return NextResponse.json({ 
        error: "Name, description, icon_url, and price_coins are required" 
      }, { status: 400 })
    }

    const { data: gift, error } = await supabase
      .from('gifts')
      .insert({
        name: name.trim(),
        description: description.trim(),
        icon_url,
        animation_url,
        price_coins,
        rarity: rarity || 'common',
        effects: effects || null,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: { gift }
    })

  } catch (error) {
    console.error("Create gift error:", error)
    return NextResponse.json({ error: "Failed to create gift" }, { status: 500 })
  }
}
