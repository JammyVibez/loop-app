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
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("shop_items")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq("category", category)
    }

    const { data: items, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch shop items" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      items: items || [],
      hasMore: items?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching shop items:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
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

    // Check if user is admin
    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { name, description, price, category, item_type, rarity, premium_only, preview_data, metadata } =
      await request.json()

    if (!name?.trim() || !description?.trim() || !category || !item_type) {
      return NextResponse.json(
        {
          error: "Name, description, category, and item_type are required",
        },
        { status: 400 },
      )
    }

    // Create shop item
    const { data: item, error: insertError } = await supabase
      .from("shop_items")
      .insert({
        name: name.trim(),
        description: description.trim(),
        price: price || 0,
        category,
        item_type,
        rarity: rarity || "common",
        premium_only: premium_only || false,
        preview_data: preview_data || {},
        metadata: metadata || {},
        is_active: true,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create shop item" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item,
    })
  } catch (error) {
    console.error("Error creating shop item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
