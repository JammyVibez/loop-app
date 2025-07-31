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

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("user_inventory")
      .select(`
        *,
        shop_item:shop_items(*)
      `)
      .eq("user_id", user.id)
      .order("purchased_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq("shop_items.category", category)
    }

    const { data: inventory, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      items: inventory || [],
      hasMore: inventory?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching inventory:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
