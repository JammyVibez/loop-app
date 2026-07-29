import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cosmeticsFromInventory } from "@/lib/cosmetics"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUserFromToken(token: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

function themePayloadFromShopItem(shopItem: any) {
  const colors = shopItem?.item_data?.colors || shopItem?.preview_data?.colors || {}
  const effects = shopItem?.item_data?.effects || shopItem?.preview_data?.effects || {}
  return {
    id: shopItem.id,
    name: shopItem.name,
    colors: {
      primary: colors.primary || "#8b5cf6",
      secondary: colors.secondary || "#3b82f6",
      accent: colors.accent || "#f59e0b",
      background: colors.background || "#0b1220",
      surface: colors.surface || "#111827",
      text: colors.text || "#f8fafc",
    },
    effects: {
      glow: Boolean(effects.glow ?? true),
      particles: Boolean(effects.particles ?? Array.isArray(effects)),
      animations: Boolean(effects.animations ?? true),
      shadows: Boolean(effects.shadows ?? true),
      list: Array.isArray(effects) ? effects : effects.list || [],
    },
    preview: shopItem?.preview_data?.preview || null,
    item_type: shopItem.item_type,
    category: shopItem.category,
  }
}

function isThemeItem(shopItem: any, itemType: string) {
  const hay = `${shopItem?.category || ""} ${itemType || ""}`.toLowerCase()
  return hay.includes("theme") && !hay.includes("badge")
}

function isCosmeticItem(shopItem: any, itemType: string) {
  const hay = `${shopItem?.category || ""} ${itemType || ""}`.toLowerCase()
  return (
    hay.includes("badge") ||
    hay.includes("frame") ||
    hay.includes("aura") ||
    hay.includes("effect") ||
    hay.includes("animation") ||
    hay.includes("avatar")
  )
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
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const inventoryItemId = body.inventory_item_id || body.inventoryItemId
    const shopItemId = body.item_id || body.itemId

    let inventoryItem: any = null

    if (inventoryItemId) {
      const { data, error } = await supabase
        .from("user_inventory")
        .select(`*, shop_item:shop_items(*)`)
        .eq("id", inventoryItemId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (error || !data) return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
      inventoryItem = data
    } else if (shopItemId) {
      const { data, error } = await supabase
        .from("user_inventory")
        .select(`*, shop_item:shop_items(*)`)
        .eq("user_id", user.id)
        .eq("item_id", shopItemId)
        .order("acquired_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error || !data) return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
      inventoryItem = data
    } else {
      return NextResponse.json({ error: "inventory_item_id or item_id is required" }, { status: 400 })
    }

    const shopItem = Array.isArray(inventoryItem.shop_item) ? inventoryItem.shop_item[0] : inventoryItem.shop_item
    if (!shopItem) return NextResponse.json({ error: "Shop item missing" }, { status: 404 })

    const itemType = inventoryItem.item_type || shopItem.item_type || shopItem.category

    // Deactivate other items of same type for this user
    await supabase
      .from("user_inventory")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("item_type", itemType)
      .neq("id", inventoryItem.id)

    const { error: updateError } = await supabase
      .from("user_inventory")
      .update({ is_active: true })
      .eq("id", inventoryItem.id)

    if (updateError) {
      return NextResponse.json({ error: "Failed to apply item" }, { status: 500 })
    }

    let themePayload: ReturnType<typeof themePayloadFromShopItem> | null = null
    const themeLike = isThemeItem(shopItem, itemType)

    if (themeLike) {
      themePayload = themePayloadFromShopItem(shopItem)
      await supabase
        .from("profiles")
        .update({
          active_theme: shopItem.id,
          theme_preferences: themePayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
    }

    let cosmetics = null
    if (isCosmeticItem(shopItem, itemType) || themeLike) {
      cosmetics = await refreshActiveCosmetics(user.id)
    }

    return NextResponse.json({
      success: true,
      message: "Item applied successfully",
      theme: themePayload,
      cosmetics,
      item: {
        id: inventoryItem.id,
        item_id: shopItem.id,
        item_name: shopItem.name,
        item_type: itemType,
        is_active: true,
      },
    })
  } catch (error) {
    console.error("Error applying item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
