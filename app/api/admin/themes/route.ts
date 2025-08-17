import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Verify admin user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Fetch all themes with statistics
    const { data: themes, error } = await supabase
      .from("marketplace_themes")
      .select(`
        *,
        theme_purchases(count),
        theme_ratings(rating)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching themes:", error)
      return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 })
    }

    // Process themes with statistics
    const themesWithStats = themes.map((theme) => ({
      ...theme,
      download_count: theme.theme_purchases?.[0]?.count || 0,
      rating_average:
        theme.theme_ratings?.length > 0
          ? theme.theme_ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / theme.theme_ratings.length
          : 0,
      rating_count: theme.theme_ratings?.length || 0,
    }))

    return NextResponse.json({ themes: themesWithStats })
  } catch (error) {
    console.error("Error in themes GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    // Verify admin user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid authentication" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const {
      name,
      description,
      category,
      price_coins,
      price_usd,
      rarity,
      tags,
      preview_images,
      theme_data,
      effects_3d,
      is_active,
    } = await request.json()

    // Create new theme
    const { data: theme, error } = await supabase
      .from("marketplace_themes")
      .insert({
        name,
        description,
        category,
        price_coins,
        price_usd,
        rarity: rarity || "common",
        tags: tags || [],
        preview_images: preview_images || [],
        theme_data: theme_data || {},
        effects_3d: effects_3d || {},
        is_active: is_active ?? true,
        creator_id: user.id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating theme:", error)
      return NextResponse.json({ error: "Failed to create theme" }, { status: 500 })
    }

    return NextResponse.json({ theme, message: "Theme created successfully" })
  } catch (error) {
    console.error("Error in theme POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
