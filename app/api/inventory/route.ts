import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUserFromToken(token: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await getUserFromToken(authHeader.replace("Bearer ", ""))
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const { data: inventory, error } = await supabase
      .from("user_inventory")
      .select(`*, shop_item:shop_items(*)`)
      .eq("user_id", user.id)
      .order("acquired_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 })
    }

    const items = (inventory || []).map((row: any) => {
      const shop = Array.isArray(row.shop_item) ? row.shop_item[0] : row.shop_item
      return {
        id: row.id,
        item_id: row.item_id,
        item_type: row.item_type || shop?.item_type || shop?.category || "item",
        item_name: shop?.name || "Item",
        item_data: shop?.item_data || {},
        preview_data: shop?.preview_data || {},
        rarity: shop?.rarity || "common",
        category: shop?.category || row.item_type,
        is_active: Boolean(row.is_active),
        purchased_at: row.acquired_at,
        acquired_at: row.acquired_at,
        shop_item: shop || null,
      }
    })

    return NextResponse.json({
      success: true,
      items,
      hasMore: items.length === limit,
    })
  } catch (error) {
    console.error("Error fetching inventory:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
