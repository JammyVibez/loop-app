
import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const { themeId, userId } = await request.json()

    if (!themeId || !userId) {
      return NextResponse.json(
        { success: false, error: "Theme ID and User ID are required" },
        { status: 400 }
      )
    }

    // Get theme details
    const { data: theme, error: themeError } = await supabase
      .from('themes')
      .select('*')
      .eq('id', themeId)
      .single()

    if (themeError || !theme) {
      return NextResponse.json(
        { success: false, error: "Theme not found" },
        { status: 404 }
      )
    }

    // Check if user already owns the theme
    const { data: existingTheme } = await supabase
      .from('user_themes')
      .select('id')
      .eq('user_id', userId)
      .eq('theme_id', themeId)
      .single()

    if (existingTheme) {
      return NextResponse.json(
        { success: false, error: "Theme already owned" },
        { status: 400 }
      )
    }

    // Check user's coin balance
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('loop_coins')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      )
    }

    if (user.loop_coins < theme.price) {
      return NextResponse.json(
        { success: false, error: "Insufficient coins" },
        { status: 400 }
      )
    }

    // Process purchase
    const { error: purchaseError } = await supabase.rpc('purchase_theme', {
      p_user_id: userId,
      p_theme_id: themeId,
      p_price: theme.price
    })

    if (purchaseError) {
      return NextResponse.json(
        { success: false, error: "Purchase failed" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Theme purchased successfully"
    })

  } catch (error) {
    console.error("Theme purchase error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
