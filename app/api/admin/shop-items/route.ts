import { type NextRequest, NextResponse } from "next/server"

function getUserFromToken(token: string) {
  // Mock admin check - replace with real auth
  return {
    id: "1",
    username: "admin",
    is_admin: true,
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = getUserFromToken(token)

    if (!user || !user.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    // Mock shop items - replace with database query
    const mockShopItems = [
      {
        id: "theme_galaxy",
        name: "Galaxy Theme",
        description: "A beautiful space-themed background",
        price: 500,
        type: "theme",
        rarity: "epic",
        is_active: true,
        created_at: "2024-01-10T00:00:00Z",
        sales_count: 25,
      },
      {
        id: "frame_golden",
        name: "Golden Frame",
        description: "Elegant golden avatar frame",
        price: 300,
        type: "avatar_frame",
        rarity: "rare",
        is_active: true,
        created_at: "2024-01-12T00:00:00Z",
        sales_count: 18,
      },
    ]

    return NextResponse.json({
      success: true,
      items: mockShopItems,
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
    const user = getUserFromToken(token)

    if (!user || !user.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { name, description, price, type, rarity, image_url } = await request.json()

    // Validate required fields
    if (!name || !price || !type) {
      return NextResponse.json(
        {
          error: "Name, price, and type are required",
        },
        { status: 400 },
      )
    }

    // In a real app, you would insert into database
    /*
    const result = await db.query(`
      INSERT INTO shop_items (name, description, price, type, rarity, image_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [name, description, price, type, rarity, image_url])
    */

    const newItem = {
      id: `item_${Date.now()}`,
      name,
      description,
      price,
      type,
      rarity: rarity || "common",
      image_url,
      is_active: true,
      created_at: new Date().toISOString(),
      sales_count: 0,
    }

    return NextResponse.json({
      success: true,
      item: newItem,
      message: "Item created successfully",
    })
  } catch (error) {
    console.error("Error creating shop item:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
