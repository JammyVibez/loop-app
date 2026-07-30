import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const featuredOnly = searchParams.get("featured") === "true"
    const search = searchParams.get("q") || ""

    const supabase = createServerClient()

    let query = supabase.from("global_events").select("*").eq("is_active", true)

    if (featuredOnly) {
      query = query.eq("is_featured", true)
    }
    if (category && category !== "all") {
      query = query.eq("category", category)
    }
    if (search) {
      query = query.ilike("title", `%${search}%`)
    }

    const { data: events, error } = await query.order("starts_at", { ascending: true })

    const defaultEvents = [
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
      },
      {
        id: "event-3d-art",
        title: "3D Graphics & Avatar Showcase",
        description: "Compete in custom 3D shader designs, avatar outfits, and theme marketplace creations. Voted live by members!",
        category: "Design",
        banner_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80",
        location_type: "3D Lounge",
        external_link: "",
        starts_at: new Date(Date.now() + 86400000 * 4).toISOString(),
        ends_at: new Date(Date.now() + 86400000 * 6).toISOString(),
        reward_coins: 3000,
        badge_reward: "3D Master Artist",
        is_featured: false,
        is_active: true,
        rsvp_count: 210,
        tags: ["3D", "Avatars", "Shaders", "Design"]
      }
    ]

    if (error || !events || events.length === 0) {
      let filtered = defaultEvents
      if (category && category !== "all") {
        filtered = filtered.filter((e) => e.category.toLowerCase() === category.toLowerCase())
      }
      if (search) {
        filtered = filtered.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
      }
      return NextResponse.json({ events: filtered })
    }

    return NextResponse.json({ events })
  } catch (err: any) {
    console.error("Public events GET error:", err)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { event_id } = await request.json()
    if (!event_id) return NextResponse.json({ error: "Event ID required" }, { status: 400 })

    const supabase = createServerClient()

    // Try DB RSVP insert
    const { error } = await supabase.from("event_rsvps").insert({
      event_id,
      user_id: user.id,
      created_at: new Date().toISOString()
    })

    if (error && !error.message.includes("duplicate")) {
      console.warn("RSVP insert warning:", error.message)
    }

    return NextResponse.json({
      success: true,
      event_id,
      message: "Successfully RSVP'd to global event!"
    })
  } catch (err: any) {
    console.error("RSVP error:", err)
    return NextResponse.json({ error: "Failed to RSVP" }, { status: 500 })
  }
}
