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
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const userId = searchParams.get("user_id")

    let query = supabase
      .from("circles")
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url),
        member_count:circle_members(count),
        is_member:circle_members!inner(user_id)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq("category", category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // If user_id provided, check membership status
    if (userId) {
      query = query.eq("circle_members.user_id", userId)
    }

    const { data: circles, error } = await query

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch circles" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      circles: circles || [],
      hasMore: circles?.length === limit,
    })
  } catch (error) {
    console.error("Error fetching circles:", error)
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

    const { name, description, category, is_private, avatar_url, banner_url } = await request.json()

    if (!name?.trim() || !description?.trim() || !category) {
      return NextResponse.json(
        {
          error: "Name, description, and category are required",
        },
        { status: 400 },
      )
    }

    // Create circle
    const { data: circle, error: insertError } = await supabase
      .from("circles")
      .insert({
        name: name.trim(),
        description: description.trim(),
        category,
        is_private: is_private || false,
        owner_id: user.id,
        avatar_url,
        banner_url,
      })
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create circle" }, { status: 500 })
    }

    // Add creator as member and admin
    await supabase.from("circle_members").insert({
      circle_id: circle.id,
      user_id: user.id,
      role: "owner",
      joined_at: new Date().toISOString(),
    })

    // Create default general chat room
    await supabase.from("circle_rooms").insert({
      circle_id: circle.id,
      name: "general",
      description: "General discussion",
      type: "text",
      created_by: user.id,
    })

    return NextResponse.json({
      success: true,
      circle,
    })
  } catch (error) {
    console.error("Error creating circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
