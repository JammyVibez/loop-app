import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const sortBy = searchParams.get("sortBy") || "popular"
    const userId = searchParams.get("userId")

    let query = supabase
      .from("themes")
      .select("*")
      .eq("is_active", true)

    if (category && category !== "all") {
      query = query.eq("category_id", category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: themes, error } = await query

    if (error) {
      console.error("Error fetching themes:", error)
      return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 })
    }

    let ownedThemeIds = new Set<string>()
    if (userId) {
      const { data: owned } = await supabase
        .from("user_themes")
        .select("theme_id")
        .eq("user_id", userId)
      ownedThemeIds = new Set((owned || []).map((row: any) => row.theme_id))
    }

    const processedThemes = (themes || []).map((theme) => ({
      ...theme,
      download_count: theme.download_count || 0,
      rating_average: Number(theme.rating_average || 0),
      rating_count: theme.rating_count || 0,
      is_owned: ownedThemeIds.has(theme.id),
      category: theme.category_id || "all",
      preview_images: theme.preview_url ? [theme.preview_url] : [],
    }))

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
