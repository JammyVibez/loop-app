import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration")
  return createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { itemId } = await request.json()
    if (!itemId) {
      return NextResponse.json({ error: "Item ID required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Fetch inventory item
    const { data: invItem } = await supabase
      .from("user_inventory")
      .select("*")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!invItem) {
      return NextResponse.json({ error: "Item not found in your inventory" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: `Equipped/Used ${invItem.item_name} successfully!`,
      item: invItem
    })
  } catch (error: any) {
    console.error("POST /api/wallet/inventory/use error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
