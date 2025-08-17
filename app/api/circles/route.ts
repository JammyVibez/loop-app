import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration')
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function getUserFromToken(token: string | null) {
  if (!token) return null
  try {
    const supabase = createServerClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return user
  } catch (error) {
    console.error('Auth error:', error)
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

    const supabase = createServerClient()

    let query = supabase
      .from("circles")
      .select(`
        *,
        creator:profiles!creator_id(id, username, display_name, avatar_url),
        member_count:circle_members(count)
      `)
      .eq("is_private", false)
      .order("created_at", { ascending: false })

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data: circles, error } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error("Error fetching circles:", error)
      return NextResponse.json({ error: "Failed to fetch circles" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      circles: circles || [],
      hasMore: circles?.length === limit,
    })
  } catch (error: any) {
    console.error("Error in circles API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Circle creation request received')

    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, category, is_private, banner_url, rules } = body

    // Validation
    if (!name || name.trim().length < 3) {
      return NextResponse.json({ error: "Circle name must be at least 3 characters" }, { status: 400 })
    }

    if (!description || description.trim().length < 10) {
      return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 })
    }

    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Check if user already has the maximum number of circles (e.g., 5)
    const { data: existingCircles, error: countError } = await supabase
      .from("circles")
      .select("id")
      .eq("creator_id", user.id)

    if (countError) {
      console.error("Error checking existing circles:", countError)
      return NextResponse.json({ error: "Failed to check existing circles" }, { status: 500 })
    }

    if (existingCircles && existingCircles.length >= 5) {
      return NextResponse.json({ error: "You can only create up to 5 circles" }, { status: 400 })
    }

    // Check if circle name is already taken
    const { data: existingCircle, error: nameError } = await supabase
      .from("circles")
      .select("id")
      .eq("name", name.trim())
      .single()

    if (nameError && nameError.code !== 'PGRST116') {
      console.error("Error checking circle name:", nameError)
      return NextResponse.json({ error: "Failed to check circle name" }, { status: 500 })
    }

    if (existingCircle) {
      return NextResponse.json({ error: "A circle with this name already exists" }, { status: 400 })
    }

    // Create the circle
    const { data: circle, error: createError } = await supabase
      .from("circles")
      .insert({
        name: name.trim(),
        description: description.trim(),
        category,
        is_private: is_private || false,
        creator_id: user.id,
        banner_url: banner_url || null,
        rules: rules || [],
        member_limit: 1000, // Default member limit
        settings: {
          allow_posts: true,
          allow_media: true,
          moderation_level: 'moderate'
        }
      })
      .select(`
        *,
        creator:profiles!creator_id(id, username, display_name, avatar_url)
      `)
      .single()

    if (createError) {
      console.error("Error creating circle:", createError)
      return NextResponse.json({ error: "Failed to create circle" }, { status: 500 })
    }

    // Add creator as first member and admin
    const { error: memberError } = await supabase
      .from("circle_members")
      .insert({
        circle_id: circle.id,
        user_id: user.id,
        role: "admin",
        status: "approved"
      })

    if (memberError) {
      console.error("Error adding creator as member:", memberError)
      // Note: Circle is already created, but we should handle this gracefully
    }

    // Update user stats for circle creation achievement
    const { error: statsError } = await supabase.rpc('update_user_stats_and_check_achievements', {
      target_user_id: user.id,
      stat_type: 'circles_created',
      increment_value: 1
    })

    if (statsError) {
      console.error("Error updating user stats:", statsError)
    }

    console.log('Circle created successfully:', circle.id)

    return NextResponse.json({
      success: true,
      circle,
      message: "Circle created successfully!"
    })

  } catch (error: any) {
    console.error("Error creating circle:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}