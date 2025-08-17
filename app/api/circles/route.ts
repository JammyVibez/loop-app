import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

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
    const authHeader = request.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    const user = await getUserFromToken(token)

    const supabase = createServerClient()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const userCircles = searchParams.get("user_circles") === "true"

    let query = supabase
      .from("circles")
      .select(`
        *,
        creator:profiles!creator_id(id, username, display_name, avatar_url, is_verified),
        member_count:circle_members(count),
        user_membership:circle_members!inner(role, status)
      `)

    if (userCircles && user) {
      // Get circles user is a member of
      query = query.eq("circle_members.user_id", user.id)
        .eq("circle_members.status", "approved")
    } else {
      // Get public circles
      query = query.eq("is_public", true)
    }

    query = query.order("created_at", { ascending: false }).limit(limit)

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    const { data: circles, error } = await query

    if (error) {
      console.error("Circles fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, circles })
  } catch (error: any) {
    console.error("Error fetching circles:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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

    const body = await request.json()
    const { name, description, category, is_public = true, circle_rules, banner_url } = body

    if (!name || !description) {
      return NextResponse.json({ error: "Name and description are required" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: circle, error } = await supabase
      .from("circles")
      .insert({
        name,
        description,
        category,
        creator_id: user.id,
        is_public,
        circle_rules,
        banner_url,
        settings: {
          allow_posts: true,
          allow_events: true,
          require_approval: !is_public
        }
      })
      .select(`
        *,
        creator:profiles!creator_id(id, username, display_name, avatar_url, is_verified)
      `)
      .single()

    if (error) {
      console.error("Circle creation error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Add creator as first member and admin
    const { error: memberError } = await supabase
      .from("circle_members")
      .insert({
        circle_id: circle.id,
        user_id: user.id,
        role: "admin",
        status: "approved",
        joined_at: new Date().toISOString()
      })

    if (memberError) {
      console.error("Member creation error:", memberError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({ success: true, circle })
  } catch (error: any) {
    console.error("Error creating circle:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}