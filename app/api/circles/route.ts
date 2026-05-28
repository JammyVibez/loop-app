import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

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

function normalizeCircle(circle: any, membershipMap = new Map<string, any>()) {
  const memberCount = Array.isArray(circle.member_count) ? circle.member_count[0]?.count : circle.member_count
  const membership = membershipMap.get(circle.id)
  return {
    ...circle,
    owner: circle.owner || circle.creator,
    member_count: Number(memberCount || circle.member_count_value || 0),
    is_member: membership?.status === "active" || membership?.status === "approved",
    membership_status: membership?.status || null,
    user_role: membership?.role || "guest",
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "24")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)
    const supabase = createServerClient()

    let query = supabase
      .from("circles")
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url),
        creator:profiles!creator_id(id, username, display_name, avatar_url),
        member_count:circle_members(count)
      `)
      .order("created_at", { ascending: false })

    if (category && category !== "all") query = query.eq("category", category)
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)

    const { data: circles, error } = await query.range(offset, offset + limit - 1)
    if (error) {
      console.error("Error fetching circles:", error)
      return NextResponse.json({ error: "Failed to fetch circles" }, { status: 500 })
    }

    const membershipMap = new Map<string, any>()
    if (user && circles?.length) {
      const { data: memberships } = await supabase
        .from("circle_members")
        .select("circle_id, role, status")
        .eq("user_id", user.id)
        .in("circle_id", circles.map((circle) => circle.id))
      memberships?.forEach((membership) => membershipMap.set(membership.circle_id, membership))
    }

    return NextResponse.json({
      success: true,
      circles: (circles || []).map((circle) => normalizeCircle(circle, membershipMap)),
      hasMore: circles?.length === limit,
    })
  } catch (error) {
    console.error("Error in circles API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name, description, category, is_private, avatar_url, banner_url, rules, tags } = await request.json()
    if (!name || name.trim().length < 3) return NextResponse.json({ error: "Circle name must be at least 3 characters" }, { status: 400 })
    if (!description || description.trim().length < 10) return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 })
    if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: existingCircles, error: countError } = await supabase.from("circles").select("id").or(`owner_id.eq.${user.id},creator_id.eq.${user.id}`)
    if (countError) return NextResponse.json({ error: "Failed to check existing circles" }, { status: 500 })
    if (existingCircles && existingCircles.length >= 5) return NextResponse.json({ error: "You can only create up to 5 circles" }, { status: 400 })

    const { data: existingCircle } = await supabase.from("circles").select("id").eq("name", name.trim()).maybeSingle()
    if (existingCircle) return NextResponse.json({ error: "A circle with this name already exists" }, { status: 400 })

    const { data: circle, error: createError } = await supabase
      .from("circles")
      .insert({
        name: name.trim(),
        description: description.trim(),
        category,
        is_private: Boolean(is_private),
        owner_id: user.id,
        creator_id: user.id,
        avatar_url: avatar_url || null,
        banner_url: banner_url || null,
        rules: rules || [],
        tags: tags || [],
        member_limit: 1000,
        settings: {
          allow_posts: true,
          allow_media: true,
          moderation_level: "moderate",
          community_studio: { enabled: true, layout: "default", theme: "cinematic" },
          bots: { enabled: false, moderation_bot: false, welcome_bot: true },
        },
      })
      .select(`*, owner:profiles!owner_id(id, username, display_name, avatar_url), creator:profiles!creator_id(id, username, display_name, avatar_url)`)
      .single()

    if (createError) {
      console.error("Error creating circle:", createError)
      return NextResponse.json({ error: "Failed to create circle" }, { status: 500 })
    }

    await supabase.from("circle_members").insert({
      circle_id: circle.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    })

    await supabase.from("circle_rooms").insert({
      circle_id: circle.id,
      name: "general",
      description: "The main community room",
      type: "text",
      is_private: false,
      created_by: user.id,
    })

    await supabase.rpc("update_user_stats_and_check_achievements", {
      target_user_id: user.id,
      stat_type: "circles_created",
      increment_value: 1,
    })

    return NextResponse.json({ success: true, circle: normalizeCircle(circle), message: "Circle created successfully!" })
  } catch (error) {
    console.error("Error creating circle:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
