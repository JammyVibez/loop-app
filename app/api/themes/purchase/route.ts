import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    const { theme_id } = await request.json()

    // Get theme details
    const { data: theme, error: themeError } = await supabase
      .from("marketplace_themes")
      .select("*")
      .eq("id", theme_id)
      .eq("is_active", true)
      .single()

    if (themeError || !theme) {
      return NextResponse.json({ error: "Theme not found" }, { status: 404 })
    }

    // Check if user already owns this theme
    const { data: existingTheme } = await supabase
      .from("user_themes")
      .select("*")
      .eq("user_id", user.id)
      .eq("theme_id", theme_id)
      .single()

    if (existingTheme) {
      return NextResponse.json({ error: "Theme already owned" }, { status: 400 })
    }

    // Get user's coin balance
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    if (profile.loop_coins < theme.price_coins) {
      return NextResponse.json({ error: "Insufficient coins" }, { status: 400 })
    }

    // Start transaction: deduct coins and add theme
    const { error: deductError } = await supabase
      .from("profiles")
      .update({
        loop_coins: profile.loop_coins - theme.price_coins,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (deductError) {
      return NextResponse.json({ error: "Failed to deduct coins" }, { status: 500 })
    }

    // Add theme to user's collection
    const { error: addThemeError } = await supabase.from("user_themes").insert({
      user_id: user.id,
      theme_id: theme_id,
      purchased_at: new Date().toISOString(),
    })

    if (addThemeError) {
      // Rollback coin deduction
      await supabase.from("profiles").update({ loop_coins: profile.loop_coins }).eq("id", user.id)

      return NextResponse.json({ error: "Failed to add theme" }, { status: 500 })
    }

    // Record purchase
    await supabase.from("theme_purchases").insert({
      user_id: user.id,
      theme_id: theme_id,
      price_paid: theme.price_coins,
      purchased_at: new Date().toISOString(),
    })

    // Create notification
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "theme_purchased",
      title: "Theme Purchased!",
      message: `You've successfully purchased ${theme.name} for ${theme.price_coins} Loop Coins.`,
      data: { theme_id, theme_name: theme.name },
    })

    return NextResponse.json({
      success: true,
      message: "Theme purchased successfully",
      new_balance: profile.loop_coins - theme.price_coins,
    })
  } catch (error) {
    console.error("Error purchasing theme:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
