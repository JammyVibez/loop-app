import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const sortBy = searchParams.get("sortBy") || "popular"
    const userId = searchParams.get("userId")

    let query = supabase
      .from("marketplace_themes")
      .select(`
        *,
        theme_purchases(count),
        theme_ratings(rating),
        user_themes!left(user_id)
      `)
      .eq("is_active", true)

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.cs.{${search}}`)
    }

    const { data: themes, error } = await query

    if (error) {
      console.error("Error fetching themes:", error)
      return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 })
    }

    // Process themes with statistics and ownership
    const processedThemes = themes.map((theme) => {
      const purchases = theme.theme_purchases || []
      const ratings = theme.theme_ratings || []
      const userThemes = theme.user_themes || []

      return {
        ...theme,
        download_count: purchases.length,
        rating_average:
          ratings.length > 0 ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length : 0,
        rating_count: ratings.length,
        is_owned: userId ? userThemes.some((ut: any) => ut.user_id === userId) : false,
      }
    })

    // Sort themes
    const sortedThemes = [...processedThemes].sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return b.download_count - a.download_count
        case "rating":
          return b.rating_average - a.rating_average
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "price-low":
          return a.price_coins - b.price_coins
        case "price-high":
          return b.price_coins - a.price_coins
        default:
          return 0
      }
    })

    return NextResponse.json({ themes: sortedThemes })
  } catch (error) {
    console.error("Error in themes GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
