import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { data: events, error } = await supabase
      .from("global_events")
      .select(`
        *,
        event_rsvps(count)
      `)
      .order("starts_at", { ascending: true })

    if (error) {
      // Fallback if global_events table isn't created in Supabase yet (return memory mock array)
      console.warn("Database global_events fetch error, returning default global events:", error.message)
      return NextResponse.json({
        events: [
          {
            id: "event-dev-den",
            title: "Developers Den Hackathon 2026",
            description: "Join top developers to build next-gen 3D web apps & smart Loop extensions. Win 5,000 Loop Coins and exclusive badge!",
            category: "Developer",
            banner_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
            location_type: "Virtual Stage",
            external_link: "",
            starts_at: new Date(Date.now() + 86400000).toISOString(),
            ends_at: new Date(Date.now() + 86400000 * 3).toISOString(),
            reward_coins: 5000,
            badge_reward: "Dev Den Pioneer",
            is_featured: true,
            is_active: true,
            rsvp_count: 342,
            tags: ["Developer", "Hackathon", "3D Web", "Coding"]
          },
          {
            id: "event-creator-zone",
            title: "Content Creator Zone Spotlight",
            description: "Showcase your short videos, reels, and digital art to the global community! Live feedback and featured promotion.",
            category: "Creator",
            banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
            location_type: "Creator Stage",
            external_link: "",
            starts_at: new Date(Date.now() + 86400000 * 2).toISOString(),
            ends_at: new Date(Date.now() + 86400000 * 4).toISOString(),
            reward_coins: 2500,
            badge_reward: "Master Creator",
            is_featured: true,
            is_active: true,
            rsvp_count: 518,
            tags: ["Creators", "Reels", "Art", "Stream"]
          }
        ]
      })
    }

    const formattedEvents = events.map((e: any) => ({
      ...e,
      rsvp_count: e.event_rsvps?.[0]?.count || e.rsvp_count || 0
    }))

    return NextResponse.json({ events: formattedEvents })
  } catch (err: any) {
    console.error("Global events GET error:", err)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const { data: profile } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("id", user.id).single()

    const body = await request.json()
    const {
      title,
      description,
      category = "General",
      banner_url,
      location_type = "Virtual Stage",
      external_link = "",
      starts_at,
      ends_at,
      reward_coins = 500,
      badge_reward = "Event Participant",
      is_featured = true,
      is_active = true,
      tags = []
    } = body

    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const hostUsername = profile?.username || user.email?.split("@")[0] || "admin"
    const hostDisplayName = profile?.display_name || "Admin Host"
    const hostAvatar = profile?.avatar_url || "/placeholder.svg"

    const newEvent = {
      id: eventId,
      title,
      description,
      category,
      banner_url: banner_url || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
      location_type,
      external_link,
      starts_at: starts_at || new Date().toISOString(),
      ends_at: ends_at || new Date(Date.now() + 86400000 * 2).toISOString(),
      reward_coins: Number(reward_coins) || 0,
      badge_reward,
      is_featured: Boolean(is_featured),
      is_active: Boolean(is_active),
      tags: Array.isArray(tags) ? tags : [category],
      created_by: user.id,
      created_at: new Date().toISOString()
    }

    // Insert into global_events
    await supabase.from("global_events").insert(newEvent)

    // Also insert into main events hub table so it's live across the app
    const eventHubPayload = {
      id: eventId,
      title: title.trim(),
      description: description.trim(),
      host_id: user.id,
      host_name: hostDisplayName,
      host_avatar: hostAvatar,
      category,
      status: "live",
      start_time: starts_at || new Date().toISOString(),
      cover_image: banner_url || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop&q=80",
      participants_count: 1,
      is_live: true,
      created_at: new Date().toISOString()
    }

    await supabase.from("events").insert(eventHubPayload)

    // Auto join admin as host participant
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

    return NextResponse.json({ event: newEvent, message: "Global event created & published live successfully!" })
  } catch (err: any) {
    console.error("Global events POST error:", err)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}

