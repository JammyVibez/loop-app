import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cosmeticsFromInventory } from "@/lib/cosmetics"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

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

async function refreshActiveCosmetics(userId: string) {
  const { data: activeItems } = await supabase
    .from("user_inventory")
    .select("id, item_id, item_type, is_active, shop_item:shop_items(id, name, category, item_type, item_data, preview_data, icon_url, preview_url, rarity)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(24)

  const cosmetics = cosmeticsFromInventory(activeItems || [])
  await supabase
    .from("profiles")
    .update({
      active_cosmetics: cosmetics,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
  return cosmetics
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
    const isTheme = /theme/i.test(itemType) || /theme/i.test(shopItem?.category || "")

    if (isTheme) {
      await supabase
        .from("profiles")
        .update({
          active_theme: null,
          theme_preferences: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    }

    const cosmetics = await refreshActiveCosmetics(user.id)

    return NextResponse.json({
      success: true,
      message: "Item removed successfully",
      cosmetics,
      cleared_theme: isTheme,
    })
  } catch (error) {
    console.error("Error removing item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
