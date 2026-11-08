import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { cosmeticsFromInventory } from "@/lib/cosmetics"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)


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

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const inventoryItemId = body.inventory_item_id || body.item_id

    if (!inventoryItemId) {
      return NextResponse.json({ error: "Inventory item ID is required" }, { status: 400 })
    }

    // Plain select — see the note in the apply route: the FK embed is an
    // enrichment, and it is null for anything whose catalogue row is gone.
    const { data: inventoryItem, error: itemError } = await supabase
      .from("user_inventory")
      .select("*")
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

    const itemType = String(inventoryItem.item_type || inventoryItem.category || "")
    const isTheme = /theme/i.test(itemType) || /theme/i.test(inventoryItem.category || "")

    if (isTheme) {
      // Drop only what the theme contributed. Owner choices that are not theme
      // assets — post presentation, chat wallpaper — survive unequipping.
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("theme_preferences")
        .eq("id", user.id)
        .maybeSingle()
      const remainingPrefs =
        currentProfile?.theme_preferences &&
        typeof currentProfile.theme_preferences === "object" &&
        !Array.isArray(currentProfile.theme_preferences)
          ? { ...(currentProfile.theme_preferences as Record<string, unknown>) }
          : null
      if (remainingPrefs) {
        for (const key of [
          "profile_background",
          "profile_audio",
          "profile_audio_title",
          "profile_audio_enabled",
          "profile_audio_autoplay",
        ]) {
          delete remainingPrefs[key]
        }
      }
      await supabase
        .from("profiles")
        .update({
          active_theme: null,
          theme_preferences: remainingPrefs && Object.keys(remainingPrefs).length ? remainingPrefs : null,
          // A profile theme's CSS, background and soundtrack all live with the
          // equipped item, so unequipping it restores the plain profile.
          profile_design_css: "",
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
