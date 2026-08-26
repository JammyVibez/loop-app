import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const LISTING_TYPES = new Set(["design", "styling", "bot"])

async function getAuthedUser(request: NextRequest) {
  if (!token) return null
  const supabase = createServerClient()
  const user = await getUserFromRequest(request)
  if (!user) return null
  return user
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"
    const search = searchParams.get("search")?.trim() || ""
    const mine = searchParams.get("mine") === "true"
    const owned = searchParams.get("owned") === "true"
    const sortBy = searchParams.get("sortBy") || "newest"

    const supabase = createServerClient()
    const user = await getAuthedUser(request)

    let query = supabase
      .from("community_marketplace_listings")
      .select(
        `
        *,
        seller:profiles!community_marketplace_listings_seller_id_fkey(
          id, username, display_name, avatar_url, video_avatar_url
        )
      `,
      )
      .eq("is_published", true)

    if (type !== "all" && LISTING_TYPES.has(type)) {
      query = query.eq("listing_type", type)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (mine && user) {
      query = query.eq("seller_id", user.id)
    }

    const { data: listings, error } = await query.limit(100)
    if (error) {
      console.error("Marketplace list error:", error)
      return NextResponse.json({ error: error.message || "Failed to load marketplace" }, { status: 500 })
    }

    let ownedIds = new Set<string>()
    if (user) {
      const { data: purchases } = await supabase
        .from("community_marketplace_purchases")
        .select("listing_id")
        .eq("buyer_id", user.id)
      ownedIds = new Set((purchases || []).map((p) => p.listing_id))
    }

    let processed = (listings || []).map((listing) => ({
      ...listing,
      is_owned: ownedIds.has(listing.id) || listing.seller_id === user?.id,
      is_seller: listing.seller_id === user?.id,
    }))

    if (owned && user) {
      processed = processed.filter((l) => l.is_owned)
    }

    processed.sort((a, b) => {
      switch (sortBy) {
        case "popular":
          return (b.sales_count || 0) - (a.sales_count || 0)
        case "price-low":
          return (a.price_coins || 0) - (b.price_coins || 0)
        case "price-high":
          return (b.price_coins || 0) - (a.price_coins || 0)
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    return NextResponse.json({ listings: processed })
  } catch (error) {
    console.error("Marketplace GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const listingType = String(body.listing_type || "")
    if (!LISTING_TYPES.has(listingType)) {
      return NextResponse.json({ error: "listing_type must be design, styling, or bot" }, { status: 400 })
    }

    const title = String(body.title || "").trim()
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const priceCoins = Math.max(0, Number(body.price_coins) || 0)
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {}

    const supabase = createServerClient()
    const { data: listing, error } = await supabase
      .from("community_marketplace_listings")
      .insert({
        seller_id: user.id,
        listing_type: listingType,
        title,
        description: String(body.description || "").trim() || null,
        price_coins: priceCoins,
        preview_url: body.preview_url || null,
        thumbnail_url: body.thumbnail_url || null,
        payload,
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        is_published: body.is_published !== false,
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        seller:profiles!community_marketplace_listings_seller_id_fkey(
          id, username, display_name, avatar_url, video_avatar_url
        )
      `,
      )
      .single()

    if (error) {
      console.error("Marketplace create error:", error)
      return NextResponse.json({ error: error.message || "Failed to create listing" }, { status: 500 })
    }

    return NextResponse.json({ success: true, listing })
  } catch (error) {
    console.error("Marketplace POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
