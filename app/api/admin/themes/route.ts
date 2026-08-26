import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

async function requireAdmin(token: string | null) {
  const user = await getUserFromRequest(request);
  if (!user) {
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
    const auth = await requireAdmin(token)
    if (auth.error) return auth.error

    const [themesRes, categoriesRes] = await Promise.all([
      supabase.from("themes").select("*").order("created_at", { ascending: false }),
      supabase.from("theme_categories").select("*").order("sort_order", { ascending: true }).limit(100),
    ])

    if (themesRes.error) {
      console.error("Error fetching themes:", themesRes.error)
      return NextResponse.json({ error: "Failed to fetch themes" }, { status: 500 })
    }

    const categories = (categoriesRes.data || []).map((c) => ({
      ...c,
      icon_url: c.icon_url || null,
      description: c.description || "",
    }))

    return NextResponse.json({
      themes: (themesRes.data || []).map((theme) => ({
        ...theme,
        download_count: theme.download_count || 0,
        rating_average: Number(theme.rating_average || 0),
        rating_count: theme.rating_count || 0,
      })),
      categories,
    })
  } catch (error) {
    console.error("Error in themes GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(token)
    if (auth.error) return auth.error

    const {
      name,
      description,
      category_id,
      price_coins,
      price_usd,
      rarity,
      tags,
      preview_url,
      thumbnail_url,
      theme_data,
      is_active,
      is_premium,
      is_featured,
    } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "Theme name is required" }, { status: 400 })
    }

    const { data: theme, error } = await supabase
      .from("themes")
      .insert({
        creator_id: auth.user!.id,
        name: name.trim(),
        description: description || "",
        category_id: category_id || null,
        price_coins: Number(price_coins) || 0,
        price_usd: Number(price_usd) || 0,
        rarity: rarity || "common",
        tags: Array.isArray(tags) ? tags : [],
        preview_url: preview_url || null,
        thumbnail_url: thumbnail_url || null,
        theme_data: theme_data || {},
        is_active: is_active !== false,
        is_premium: Boolean(is_premium),
        is_featured: Boolean(is_featured),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating theme:", error)
      return NextResponse.json({ error: "Failed to create theme" }, { status: 500 })
    }

    return NextResponse.json({ success: true, theme })
  } catch (error) {
    console.error("Error in themes POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAdmin(token)
    if (auth.error) return auth.error

    const body = await request.json()
    const themeId = body.id || body.theme_id
    if (!themeId) return NextResponse.json({ error: "Theme ID is required" }, { status: 400 })

    const { data: existing } = await supabase
      .from("themes")
      .select("id")
      .eq("id", themeId)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Theme not found" }, { status: 404 })

    const allowed = [
      "name",
      "description",
      "category_id",
      "price_coins",
      "price_usd",
      "rarity",
      "tags",
      "preview_url",
      "thumbnail_url",
      "theme_data",
      "is_active",
      "is_premium",
      "is_featured",
    ]
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key]
    }

    const { data: theme, error } = await supabase
      .from("themes")
      .update(patch)
      .eq("id", themeId)
      .select()
      .single()

    if (error) {
      console.error("Error updating theme:", error)
      return NextResponse.json({ error: "Failed to update theme" }, { status: 500 })
    }

    return NextResponse.json({ success: true, theme })
  } catch (error) {
    console.error("Error in themes PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdmin(token)
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const themeId = searchParams.get("id")
    if (!themeId) return NextResponse.json({ error: "Theme ID is required" }, { status: 400 })

    const { data: existing } = await supabase
      .from("themes")
      .select("id")
      .eq("id", themeId)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: "Theme not found" }, { status: 404 })

    const { error } = await supabase.from("themes").delete().eq("id", themeId)
    if (error) {
      console.error("Error deleting theme:", error)
      return NextResponse.json({ error: "Failed to delete theme" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Theme deleted" })
  } catch (error) {
    console.error("Error in themes DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
