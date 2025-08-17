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

// Get all circles with filtering and pagination
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

    // Check if user is admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const status = searchParams.get("status") // active, banned, private, public

    let query = supabase
      .from("circles")
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified, is_premium),
        member_count:circle_members(count)
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    if (category) {
      query = query.eq("category", category)
    }

    if (status === "private") {
      query = query.eq("is_private", true)
    } else if (status === "public") {
      query = query.eq("is_private", false)
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

// Create a new circle (admin override)
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
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { 
      name, 
      description, 
      category, 
      is_private, 
      avatar_url, 
      banner_url,
      owner_id,
      rules,
      tags
    } = await request.json()

    // Validate required fields
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
        owner_id: owner_id || user.id,
        avatar_url,
        banner_url,
        rules: rules || {},
        tags: tags || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (insertError) {
      console.error("Database insert error:", insertError)
      return NextResponse.json({ error: "Failed to create circle" }, { status: 500 })
    }

    // Add creator as member and owner
    await supabase.from("circle_members").insert({
      circle_id: circle.id,
      user_id: owner_id || user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      circle,
      message: "Circle created successfully"
    })
  } catch (error) {
    console.error("Error creating circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Update a circle (admin override)
export async function PUT(request: NextRequest) {
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
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { 
      circleId,
      name, 
      description, 
      category, 
      is_private, 
      avatar_url, 
      banner_url,
      owner_id,
      rules,
      tags
    } = await request.json()

    // Validate circle exists
    const { data: existingCircle } = await supabase
      .from("circles")
      .select("id, owner_id")
      .eq("id", circleId)
      .single()

    if (!existingCircle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Update circle
    const { data: updatedCircle, error: updateError } = await supabase
      .from("circles")
      .update({
        name: name?.trim() || undefined,
        description: description?.trim() || undefined,
        category: category || undefined,
        is_private: typeof is_private !== 'undefined' ? is_private : undefined,
        owner_id: owner_id || undefined,
        avatar_url: avatar_url || undefined,
        banner_url: banner_url || undefined,
        rules: rules || undefined,
        tags: tags || undefined,
        updated_at: new Date().toISOString()
      })
      .eq("id", circleId)
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified, is_premium)
      `)
      .single()

    if (updateError) {
      console.error("Database update error:", updateError)
      return NextResponse.json({ error: "Failed to update circle" }, { status: 500 })
    }

    // If owner changed, update member roles
    if (owner_id && owner_id !== existingCircle.owner_id) {
      // Update old owner role to admin
      await supabase
        .from("circle_members")
        .update({ role: "admin" })
        .eq("circle_id", circleId)
        .eq("user_id", existingCircle.owner_id)

      // Make new owner the owner
      await supabase
        .from("circle_members")
        .update({ role: "owner" })
        .eq("circle_id", circleId)
        .eq("user_id", owner_id)
    }

    return NextResponse.json({
      success: true,
      circle: updatedCircle,
      message: "Circle updated successfully"
    })
  } catch (error) {
    console.error("Error updating circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Delete a circle (admin override)
export async function DELETE(request: NextRequest) {
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
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!adminProfile || !adminProfile.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const circleId = searchParams.get("circleId")

    if (!circleId) {
      return NextResponse.json({ error: "Circle ID is required" }, { status: 400 })
    }

    // Check if circle exists
    const { data: existingCircle } = await supabase
      .from("circles")
      .select("id")
      .eq("id", circleId)
      .single()

    if (!existingCircle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 })
    }

    // Delete circle (this will cascade delete related records)
    const { error: deleteError } = await supabase
      .from("circles")
      .delete()
      .eq("id", circleId)

    if (deleteError) {
      console.error("Database delete error:", deleteError)
      return NextResponse.json({ error: "Failed to delete circle" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Circle deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
