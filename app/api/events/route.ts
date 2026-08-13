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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const limit = Number(searchParams.get("limit") || "50")

    const supabase = createServerClient()

    // Platform-wide (admin) events live in global_events; community-hosted
    // stages live in events. Merge both so the Events Stage hub is a single
    // synchronized view, with official events pinned first.
    let globalQuery = supabase
      .from("global_events")
      .select("*")
      .eq("is_active", true)
      .order("starts_at", { ascending: true })
      .limit(limit)

    if (searchParams.get("featured") === "true") {
      globalQuery = globalQuery.eq("is_featured", true)
    }

    const { data: globalEvents, error: globalError } = await globalQuery
    if (globalError) {
      console.warn("Fetch global events warning:", globalError.message)
    }

    const officialEvents = (globalEvents || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      description: e.description || "",
      host_id: null,
      host_name: "Loop Official",
      host_avatar: "",
      category: e.category || "Community",
      status: e.status || undefined,
      start_time: e.starts_at || e.start_time,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      cover_image: e.banner_url || undefined,
      participants_count: e.rsvp_count || 0,
      is_live: Boolean(e.is_live),
      is_active: e.is_active !== false,
      is_featured: Boolean(e.is_featured),
      location_type: e.location_type,
      external_link: e.external_link,
      reward_coins: e.reward_coins,
      badge_reward: e.badge_reward,
      tags: e.tags,
    }))

    let query = supabase
      .from("events")
      .select("*")
      .order("start_time", { ascending: true })
      .limit(limit)

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (status) {
      query = query.eq("status", status)
    }

    const { data: events, error } = await query

    if (error && error.code !== "PGRST116") {
      console.warn("Fetch events warning:", error.message)
    }

    // Merge, dedupe by id, official events first
    const merged = [...officialEvents, ...(events || [])]
    const seen = new Set<string>()
    const deduped = merged.filter((e: any) => {
      if (seen.has(e.id)) return false
      seen.add(e.id)
      return true
    })

    return NextResponse.json({
      success: true,
      events: deduped.slice(0, limit),
    })
  } catch (error: any) {
    console.error("GET /api/events error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const user = await getUserFromToken(token)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, category, start_time, cover_image, is_live, circle_id } = body

    if (!title || title.trim().length < 3) {
      return NextResponse.json({ error: "Title must be at least 3 characters" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url, is_organization, organization_name")
      .eq("id", user.id)
      .single()

    const hostUsername = profile?.username || user.email?.split("@")[0] || "user"
    const hostDisplayName = profile?.organization_name || profile?.display_name || hostUsername
    const hostAvatar = profile?.avatar_url || "/placeholder.svg"

    const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

    const eventPayload = {
      id: eventId,
      title: title.trim(),
      description: description ? description.trim() : "",
      host_id: user.id,
      host_name: hostDisplayName,
      host_avatar: hostAvatar,
      category: category || "General",
      status: is_live ? "live" : "upcoming",
      start_time: start_time || new Date().toISOString(),
      cover_image: cover_image || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80",
      participants_count: 1,
      is_live: Boolean(is_live),
      circle_id: circle_id || null,
      created_at: new Date().toISOString()
    }

    const { data: newEvent, error: insertError } = await supabase
      .from("events")
      .insert(eventPayload)
      .select()
      .single()

    if (insertError) {
      console.error("Create event error:", insertError)
      return NextResponse.json({ error: insertError.message || "Failed to create event" }, { status: 500 })
    }

    // Auto add host as participant
    await supabase.from("event_participants").insert({
      id: `p-${user.id}-${eventId}`,
      event_id: eventId,
      user_id: user.id,
      username: hostUsername,
      display_name: hostDisplayName,
      avatar_url: hostAvatar,
      role: "host",
      status: "joined",
      joined_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      event: newEvent || eventPayload,
      message: "Event scheduled successfully!"
    })
  } catch (error: any) {
    console.error("POST /api/events error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
