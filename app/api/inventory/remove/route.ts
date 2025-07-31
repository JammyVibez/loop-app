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

    // Get inventory item
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

    // Deactivate the item
    const { error: updateError } = await supabase
      .from("user_inventory")
      .update({ is_active: false })
      .eq("id", inventory_item_id)

    if (updateError) {
      console.error("Error deactivating item:", updateError)
      return NextResponse.json({ error: "Failed to remove item" }, { status: 500 })
    }

    // Reset user profile theme if it's a theme
    if (inventoryItem.shop_item.item_type === "theme") {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          theme_data: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (profileError) {
        console.error("Error resetting profile theme:", profileError)
      }
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
