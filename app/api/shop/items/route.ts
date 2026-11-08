import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)


export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("shop_items")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq("category", category)
    }

    const { data: items, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch shop items" }, { status: 500 })
    }

    // A profile theme's CSS is the thing buyers pay for. The storefront gets
    // the artwork, soundtrack and colour tokens, never the stylesheet itself —
    // equipping applies it server-side (see /api/inventory/apply).
    const safeItems = (items || []).map((item) => {
      const data = item?.item_data
      if (!data || typeof data !== "object" || Array.isArray(data) || !("profile_css" in data)) {
        return item
      }
      const { profile_css: _profileCss, ...rest } = data as Record<string, unknown>
      return { ...item, item_data: rest }
    })

    return NextResponse.json({
      success: true,
      items: safeItems,
      hasMore: items?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching shop items:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {

    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { name, description, price, price_coins, category, item_type, rarity, premium_only, preview_data, metadata } =
      await request.json()

    if (!name?.trim() || !description?.trim() || !category || !item_type) {
      return NextResponse.json(
        {
          error: "Name, description, category, and item_type are required",
        },
        { status: 400 },
      )
    }

    // Create shop item — the live schema stores the coin price in
    // price_coins (price_usd for USD); accept both `price` (legacy
    // client payload) and `price_coins` so old/new admins both work.
    const { data: item, error: insertError } = await supabase
      .from("shop_items")
      .insert({
        name: name.trim(),
        description: description.trim(),
        price_coins: Number(price_coins ?? price ?? 0),
        category,
        item_type,
        rarity: rarity || "common",
        premium_only: premium_only || false,
        preview_data: preview_data || {},
        metadata: metadata || {},
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create shop item" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item,
    })
  } catch (error) {
    console.error("Error creating shop item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
