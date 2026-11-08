import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { cosmeticsFromInventory } from "@/lib/cosmetics"
import { sanitizeProfileCustomCss } from "@/lib/profile-custom-css"
import { isProfileThemeItem, readProfileThemeItemData } from "@/lib/profile-theme"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)


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
  const hay = `${shopItem?.category || ""} ${itemType || ""} ${shopItem?.name || ""}`.toLowerCase()
  // Everything that isn't a theme or a coin pack is an equipable cosmetic:
  // badges, frames, auras, fonts, post/card effects, tree skins, sounds,
  // profile styling, etc. The client cosmetics engine maps each one to a
  // visible slot (see lib/cosmetics.ts classify()).
  return (
    hay.includes("badge") ||
    hay.includes("frame") ||
    hay.includes("aura") ||
    hay.includes("effect") ||
    hay.includes("animation") ||
    hay.includes("avatar") ||
    hay.includes("font") ||
    hay.includes("card_effect") ||
    hay.includes("post_card") ||
    hay.includes("post") ||
    hay.includes("tree") ||
    hay.includes("branch") ||
    hay.includes("sound") ||
    hay.includes("chime") ||
    hay.includes("bell") ||
    hay.includes("notification") ||
    hay.includes("profile") ||
    hay.includes("design") ||
    hay.includes("styling") ||
    hay.includes("sticker") ||
    hay.includes("banner") ||
    hay.includes("ring") ||
    hay.includes("sparkle") ||
    hay.includes("glow")
  )
}

/**
 * The catalogue fields a cosmetic needs, taken from the inventory row's own
 * snapshot. Used when the shop row is gone — which is the normal state for
 * anything bought before the catalogue was last re-seeded, because the foreign
 * key clears `item_id` on delete.
 */
function snapshotAsShopItem(row: any) {
  const name = row?.item_name || null
  if (!name) return null
  return {
    id: row.item_id || row.id,
    name,
    category: row.category || row.item_type,
    item_type: row.item_type,
    item_data: row.item_data || {},
    preview_data: row.preview_data || {},
    rarity: row.rarity || "common",
    icon_url: null,
    preview_url: null,
    // Marks the source so a caller can tell the two apart when debugging.
    from_snapshot: true,
  }
}

async function refreshActiveCosmetics(userId: string) {
  const { data: activeItems } = await supabase
    .from("user_inventory")
    .select(
      "id, item_id, item_type, is_active, item_name, item_data, preview_data, category, rarity, shop_item:shop_items(id, name, category, item_type, item_data, preview_data, icon_url, preview_url, rarity)",
    )
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

    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const inventoryItemId = body.inventory_item_id || body.inventoryItemId
    const shopItemId = body.item_id || body.itemId

    let inventoryItem: any = null

    // Deliberately a plain select: embedding shop_items through the foreign key
    // depends on the schema cache and silently returns null whenever item_id
    // has been cleared, which is what produced "Shop item missing" for items
    // the user could see in their inventory.
    if (inventoryItemId) {
      const { data, error } = await supabase
        .from("user_inventory")
        .select("*")
        .eq("id", inventoryItemId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (error || !data) return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
      inventoryItem = data
    } else if (shopItemId) {
      const { data, error } = await supabase
        .from("user_inventory")
        .select("*")
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

    // The live catalogue row wins when it exists (an admin may have retuned the
    // colours); the row's own snapshot is the fallback when it does not.
    let shopItem: any = null
    if (inventoryItem.item_id) {
      const { data } = await supabase.from("shop_items").select("*").eq("id", inventoryItem.item_id).maybeSingle()
      shopItem = data || null
    }

    const fromSnapshot = !shopItem
    if (!shopItem) shopItem = snapshotAsShopItem(inventoryItem)

    if (!shopItem) {
      // Nothing names this item anywhere. Say so plainly, and leave it
      // unequipped rather than activating a blank slot.
      return NextResponse.json(
        { error: "This item is no longer in the catalogue, so it can't be equipped." },
        { status: 409 },
      )
    }

    // Self-heal: rows written before the snapshot columns existed still resolve
    // once, and then carry their own identity for good.
    if (!fromSnapshot) {
      await supabase
        .from("user_inventory")
        .update({
          item_name: inventoryItem.item_name || shopItem.name,
          item_data: inventoryItem.item_data || shopItem.item_data || {},
          preview_data: inventoryItem.preview_data || shopItem.preview_data || {},
          category: inventoryItem.category || shopItem.category,
          rarity: inventoryItem.rarity || shopItem.rarity,
        })
        .eq("id", inventoryItem.id)
    }

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

    // Profile themes carry their own CSS, background picture and soundtrack on
    // top of the usual colour tokens. The CSS is scoped and sanitised here,
    // never in the browser, so an admin paste can never escape the profile.
    const profileTheme = isProfileThemeItem(shopItem) ? readProfileThemeItemData(shopItem.item_data) : null
    let profileThemeCss = ""
    if (profileTheme?.css) {
      try {
        profileThemeCss = sanitizeProfileCustomCss(profileTheme.css)
      } catch (error) {
        console.error("Profile theme CSS rejected:", error)
      }
    }
    const themeLike = isThemeItem(shopItem, itemType) || Boolean(profileTheme)

    if (themeLike) {
      themePayload = themePayloadFromShopItem(shopItem)
      await supabase
        .from("profiles")
        .update({
          active_theme: shopItem.id,
          theme_preferences: {
            ...themePayload,
            ...(profileTheme?.backgroundUrl ? { profile_background: profileTheme.backgroundUrl } : {}),
            ...(profileTheme?.audioUrl ? { profile_audio: profileTheme.audioUrl } : {}),
            ...(profileTheme?.audioTitle ? { profile_audio_title: profileTheme.audioTitle } : {}),
          },
          // Switching to a plain colour theme clears the previous profile CSS
          // instead of leaving a half-applied design behind.
          profile_design_css: profileThemeCss,
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
      profile_theme: profileTheme
        ? { has_css: Boolean(profileThemeCss), background: Boolean(profileTheme.backgroundUrl), audio: Boolean(profileTheme.audioUrl) }
        : null,
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
