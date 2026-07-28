import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUserFromToken(token: string) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const inventoryItemId = body.inventory_item_id || body.item_id

    if (!inventoryItemId) {
      return NextResponse.json({ error: "Inventory item ID is required" }, { status: 400 })
    }

    const { data: inventoryItem, error: itemError } = await supabase
      .from("user_inventory")
      .select(`*, shop_item:shop_items(*)`)
      .eq("id", inventoryItemId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (itemError || !inventoryItem) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from("user_inventory")
      .update({ is_active: false })
      .eq("id", inventoryItemId)

    if (updateError) {
      return NextResponse.json({ error: "Failed to remove item" }, { status: 500 })
    }

    const shopItem = Array.isArray(inventoryItem.shop_item) ? inventoryItem.shop_item[0] : inventoryItem.shop_item
    const itemType = String(inventoryItem.item_type || shopItem?.item_type || shopItem?.category || "")
    const isThemeLike = /theme|effect|animation/i.test(itemType) || /theme|effect|animation/i.test(shopItem?.category || "")

    if (isThemeLike) {
      await supabase
        .from("profiles")
        .update({
          active_theme: null,
          theme_preferences: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    }

    return NextResponse.json({
      success: true,
      message: "Item removed successfully",
    })
  } catch (error) {
    console.error("Error removing item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
