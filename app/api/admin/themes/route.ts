import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function requireAdmin(token: string | null) {
  if (!token) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return { error: NextResponse.json({ error: "Invalid authentication" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()

  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { user }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const auth = await requireAdmin(token)
    if (auth.error) return auth.error

    const { data: themes, error } = await supabase
      .from("themes")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching themes:", error)
      return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 })
    }

    return NextResponse.json({
      themes: (themes || []).map((theme) => ({
        ...theme,
        download_count: theme.download_count || 0,
        rating_average: Number(theme.rating_average || 0),
        rating_count: theme.rating_count || 0,
      })),
    })
  } catch (error) {
    console.error("Error in themes GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const auth = await requireAdmin(token)
    if (auth.error) return auth.error

    const {
      name,
      description,
      price_coins,
      price_usd,
      rarity,
      tags,
      preview_url,
      thumbnail_url,
      theme_data,
      is_active,
    } = await request.json()

    const { data: theme, error } = await supabase
      .from("themes")
      .insert({
        creator_id: auth.user!.id,
        name,
        description,
        price_coins: price_coins || 0,
        price_usd: price_usd || 0,
        rarity: rarity || "common",
        tags: tags || [],
        preview_url: preview_url || null,
        thumbnail_url: thumbnail_url || null,
        theme_data: theme_data || {},
        is_active: is_active !== false,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating theme:", error)
      return NextResponse.json({ error: "Failed to create theme" }, { status: 500 })
    }

    return NextResponse.json({ theme })
  } catch (error) {
    console.error("Error in themes POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
