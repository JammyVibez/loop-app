import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { circleCreateLimitMessage, getCircleCreateLimit } from "@/lib/circle-limits"

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
    member_count: Number(memberCount || circle.member_count_value || circle.member_count || 0),
    max_members: circle.max_members ?? circle.member_limit ?? 1000,
    is_member: membership?.status === "active" || membership?.status === "approved",
    membership_status: membership?.status || null,
    user_role: membership?.role || "guest",
  }
}

const defaultSettings = {
  allow_posts: true,
  allow_media: true,
  moderation_level: "moderate",
  community_studio: { enabled: true, layout: "default", theme: "cinematic", accent: "#22d3ee" },
  bots: { enabled: false, moderation_bot: false, welcome_bot: true },
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "24")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const category = searchParams.get("category")
    const search = searchParams.get("search")
    const mine = searchParams.get("mine") === "true"
    const joined = searchParams.get("joined") === "true"
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)
    const supabase = createServerClient()

    if (mine || joined) {
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

      let membershipQuery = supabase
        .from("circle_members")
        .select("circle_id, role, status")
        .eq("user_id", user.id)
        .neq("status", "banned")

      if (mine && !joined) {
        membershipQuery = membershipQuery.in("role", ["owner", "admin", "moderator"])
      }

      const { data: memberships, error: membershipError } = await membershipQuery

      if (membershipError) {
        return NextResponse.json({ error: "Failed to fetch managed circles" }, { status: 500 })
      }

      const membershipMap = new Map<string, any>()
      ;(memberships || []).forEach((membership) => membershipMap.set(membership.circle_id, membership))
      const ids = Array.from(membershipMap.keys())
      if (!ids.length) {
        return NextResponse.json({ success: true, circles: [], hasMore: false })
      }

      let circlesQuery = supabase
        .from("circles")
        .select(`
          *,
          owner:profiles!owner_id(id, username, display_name, avatar_url),
          creator:profiles!creator_id(id, username, display_name, avatar_url),
          member_count:circle_members(count)
        `)
        .in("id", ids)
        .order("created_at", { ascending: false })

      // Bio tags / joined list should only show active communities
      if (joined) circlesQuery = circlesQuery.eq("is_active", true)

      let { data: circles, error } = await circlesQuery
      if (error && (/is_active/i.test(error.message || "") || error.code === "PGRST204")) {
        ;({ data: circles, error } = await supabase
          .from("circles")
          .select(`
            *,
            owner:profiles!owner_id(id, username, display_name, avatar_url),
            creator:profiles!creator_id(id, username, display_name, avatar_url),
            member_count:circle_members(count)
          `)
          .in("id", ids)
          .order("created_at", { ascending: false }))
      }

      if (error) {
        return NextResponse.json({ error: "Failed to fetch circles" }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        circles: (circles || []).map((circle) => normalizeCircle(circle, membershipMap)),
        hasMore: false,
      })
    }

    let query = supabase
      .from("circles")
      .select(`
        *,
        owner:profiles!owner_id(id, username, display_name, avatar_url),
        creator:profiles!creator_id(id, username, display_name, avatar_url),
        member_count:circle_members(count)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (category && category !== "all") query = query.eq("category", category)
    if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)

    let { data: circles, error } = await query.range(offset, offset + limit - 1)
    // Compat if is_active column missing on older DBs
    if (error?.code === "PGRST204" || /is_active/i.test(error?.message || "")) {
      ;({ data: circles, error } = await supabase
        .from("circles")
        .select(`
          *,
          owner:profiles!owner_id(id, username, display_name, avatar_url),
          creator:profiles!creator_id(id, username, display_name, avatar_url),
          member_count:circle_members(count)
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1))
      if (category && category !== "all") {
        circles = (circles || []).filter((c: any) => c.category === category)
      }
    }
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
    if (!name || name.trim().length < 3) {
      return NextResponse.json({ error: "Circle name must be at least 3 characters" }, { status: 400 })
    }
    if (!description || description.trim().length < 10) {
      return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 })
    }
    if (!category) return NextResponse.json({ error: "Category is required" }, { status: 400 })

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_premium, premium_expires_at")
      .eq("id", user.id)
      .maybeSingle()

    const premiumActive =
      Boolean(profile?.is_premium) &&
      (!profile?.premium_expires_at || new Date(profile.premium_expires_at) > new Date())
    const createLimit = getCircleCreateLimit(premiumActive)

    const { data: existingCircles, error: countError } = await supabase
      .from("circles")
      .select("id")
      .or(`owner_id.eq.${user.id},creator_id.eq.${user.id}`)
    if (countError) return NextResponse.json({ error: "Failed to check existing circles" }, { status: 500 })
    const ownedCount = existingCircles?.length || 0
    if (ownedCount >= createLimit) {
      return NextResponse.json(
        {
          error: circleCreateLimitMessage(premiumActive, ownedCount),
          limit: createLimit,
          current: ownedCount,
          upgrade_required: !premiumActive,
        },
        { status: 400 },
      )
    }

    const { data: existingCircle } = await supabase.from("circles").select("id").eq("name", name.trim()).maybeSingle()
    if (existingCircle) {
      return NextResponse.json({ error: "A circle with this name already exists" }, { status: 400 })
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      category,
      is_private: Boolean(is_private),
      owner_id: user.id,
      creator_id: user.id,
      avatar_url: avatar_url || null,
      banner_url: banner_url || null,
      rules: Array.isArray(rules) ? rules : rules || [],
      tags: Array.isArray(tags) ? tags : tags || [],
      max_members: 1000,
      member_count: 1,
      settings: defaultSettings,
    }

    let { data: circle, error: createError } = await supabase
      .from("circles")
      .insert(payload)
      .select(`*, owner:profiles!owner_id(id, username, display_name, avatar_url), creator:profiles!creator_id(id, username, display_name, avatar_url)`)
      .single()

    // Compat retry if settings column is missing in older DBs
    if (createError?.code === "PGRST204" && String(createError.message || "").includes("settings")) {
      delete payload.settings
      ;({ data: circle, error: createError } = await supabase
        .from("circles")
        .insert(payload)
        .select(`*, owner:profiles!owner_id(id, username, display_name, avatar_url), creator:profiles!creator_id(id, username, display_name, avatar_url)`)
        .single())
    }

    if (createError) {
      console.error("Error creating circle:", createError)
      return NextResponse.json(
        { error: createError.message || "Failed to create circle" },
        { status: 500 },
      )
    }

    const { error: memberError } = await supabase.from("circle_members").insert({
      circle_id: circle.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      joined_at: new Date().toISOString(),
    })
    if (memberError) console.error("circle_members insert:", memberError)

    const { error: roomError } = await supabase.from("circle_rooms").insert({
      circle_id: circle.id,
      name: "general",
      description: "The main community room",
      type: "text",
      is_private: false,
      created_by: user.id,
    })
    if (roomError) console.error("circle_rooms insert:", roomError)

    try {
      await supabase.rpc("update_user_stats_and_check_achievements", {
        target_user_id: user.id,
        stat_type: "circles_created",
        increment_value: 1,
      })
    } catch (rpcError) {
      console.error("achievement rpc:", rpcError)
    }

    return NextResponse.json({
      success: true,
      circle: normalizeCircle(circle),
      message: "Circle created successfully!",
    })
  } catch (error: any) {
    console.error("Error creating circle:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
