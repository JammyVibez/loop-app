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

    const { inventory_item_id } = await request.json()

    if (!inventory_item_id) {
      return NextResponse.json({ error: "Inventory item ID is required" }, { status: 400 })
    }

    // Get inventory item with shop item details
    const { data: inventoryItem, error: itemError } = await supabase
      .from("user_inventory")
      .select(`
        *,
        shop_item:shop_items(*)
      `)
      .eq("id", inventory_item_id)
      .eq("user_id", user.id)
      .single()

    if (itemError || !inventoryItem) {
      return NextResponse.json({ error: "Inventory item not found" }, { status: 404 })
    }

    const shopItem = inventoryItem.shop_item

    // Remove any currently active items of the same type
    await supabase
      .from("user_inventory")
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("item_id", shopItem.id)
      .neq("id", inventory_item_id)

    // For themes and avatar frames, only one can be active at a time
    if (shopItem.item_type === "theme" || shopItem.item_type === "avatar_frame") {
      await supabase
        .from("user_inventory")
        .update({ is_active: false })
        .eq("user_id", user.id)
        .in("shop_items.item_type", [shopItem.item_type])
        .neq("id", inventory_item_id)
    }

    // Activate the selected item
    const { error: updateError } = await supabase
      .from("user_inventory")
      .update({ is_active: true })
      .eq("id", inventory_item_id)

    if (updateError) {
      console.error("Error activating item:", updateError)
      return NextResponse.json({ error: "Failed to apply item" }, { status: 500 })
    }

    // Update user profile with theme data if it's a theme
    if (shopItem.item_type === "theme") {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          theme_data: shopItem.preview_data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (profileError) {
        console.error("Error updating profile theme:", profileError)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Item applied successfully",
    })
  } catch (error) {
    console.error("Error applying item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
