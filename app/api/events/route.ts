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
    const limit = Number(searchParams.get("limit") || "20")

    const supabase = createServerClient()

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

    return NextResponse.json({
      success: true,
      events: events || []
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
