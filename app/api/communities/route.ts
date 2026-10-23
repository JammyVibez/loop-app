import { type NextRequest, NextResponse } from "next/server"
import { communityClient, listCommunitiesForDiscovery, logCommunityActivity, ensureDefaultSpaces, upsertCategoryConfig } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"
import { getCategoryConfig } from "@/lib/community-categories"
import { circleCreateLimitMessage, getCircleCreateLimit } from "@/lib/circle-limits"
import { isProUser } from "@/lib/pro-features"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sort = searchParams.get("sort") || "trending"
    const category = searchParams.get("category") || undefined
    const search = searchParams.get("search") || undefined
    const limit = Number.parseInt(searchParams.get("limit") || "24")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const viewer = await getUserFromRequest(request)
    const sb = communityClient()

    const { communities, error } = await listCommunitiesForDiscovery(sb, {
      sort,
      category,
      search,
      viewerId: viewer?.id || null,
      limit: Math.min(limit, 50),
      offset,
    })
    if (error) {
      console.error("[communities] list error:", error)
      return NextResponse.json({ error: "Failed to load communities" }, { status: 500 })
    }
    return NextResponse.json({ communities })
  } catch (e: any) {
    console.error("[communities] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load communities" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to create a community" }, { status: 401 })

    const body = await request.json()
    const {
      name,
      description = "",
      category = "general",
      tags = [],
      is_private = false,
      rules = {},
      icon,
      banner,
      accent_color,
      layout_preset = "default",
      template = "accept", // accept | customize | minimal
      handle: requestedHandle,
      welcome_message,
    } = body

    if (!name || !name.trim()) return NextResponse.json({ error: "Give your community a name" }, { status: 400 })

    const sb = communityClient()

    // Pro limits: non-pro users get a creation cap
    const { data: profile } = await sb.from("profiles").select("is_premium, premium_expires_at, is_admin").eq("id", user.id).maybeSingle()
    const pro = isProUser(profile as any)
    if (!pro && !profile?.is_admin) {
      const { count } = await sb.from("circles").select("id", { count: "exact", head: true }).eq("owner_id", user.id)
      const limit = getCircleCreateLimit(pro)
      if ((count || 0) >= limit) {
        return NextResponse.json({ error: circleCreateLimitMessage(pro, count || 0) }, { status: 403 })
      }
    }

    // Handle: unique slug
    const baseHandle =
      (requestedHandle || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40) || `community-${Date.now()}`
    let handle = baseHandle
    const { data: existing } = await sb.from("circles").select("id").eq("handle", handle).maybeSingle()
    if (existing) handle = `${baseHandle}-${Math.floor(Math.random() * 9000) + 1000}`

    const cfg = getCategoryConfig(category)

    const { data: circle, error } = await sb
      .from("circles")
      .insert({
        name: name.trim().slice(0, 100),
        description: description.slice(0, 2000),
        category,
        tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
        is_private: Boolean(is_private),
        is_public: !is_private,
        rules: rules || {},
        owner_id: user.id,
        creator_id: user.id,
        member_count: 1,
        avatar_url: icon || null,
        banner_url: banner || null,
        cover_url: banner || null,
        accent_color: accent_color || cfg.accent,
        layout_preset,
        handle,
        welcome_message: welcome_message || null,
        enabled_features: {
          creator_gallery: cfg.recommendedFeatures.includes("creator_gallery") || cfg.recommendedFeatures.includes("fan_showcase"),
          art_challenges: cfg.recommendedFeatures.includes("art_challenges") || cfg.recommendedFeatures.includes("challenges"),
          projects: cfg.recommendedSpaces.some((s: any) => s.type === "projects"),
          events: cfg.recommendedSpaces.some((s: any) => s.type === "events"),
          chat: cfg.recommendedSpaces.some((s: any) => s.type === "chat"),
          polls: cfg.recommendedSpaces.some((s: any) => s.type === "polls"),
          qa: cfg.recommendedSpaces.some((s: any) => s.type === "qa"),
          gallery: cfg.recommendedSpaces.some((s: any) => s.type === "gallery"),
          memory: true,
          moments: true,
          dna: true,
          evolution: true,
          projects_enabled: cfg.recommendedSpaces.some((s: any) => s.type === "projects"),
        },
        settings: {
          allow_posts: true,
          allow_media: true,
          moderation_level: "moderate",
          community_studio: { enabled: true, layout: "default", theme: "cinematic", accent: accent_color || cfg.accent },
        },
      })
      .select()
      .single()

    if (error || !circle) {
      console.error("[communities] create error:", error)
      return NextResponse.json({ error: "Failed to create community: " + (error?.message || "") }, { status: 500 })
    }

    // Member row for the owner
    await sb.from("circle_members").insert({
      circle_id: circle.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      contribution_score: 10,
    })

    // Seed category config + default spaces from the template
    await upsertCategoryConfig(sb, category)
    await ensureDefaultSpaces(sb, circle, user.id, { template })

    // First memory
    await sb.from("community_memory").insert({
      circle_id: circle.id,
      kind: "milestone",
      title: `${name.trim()} was born`,
      description: "The world has been created. Welcome to the beginning.",
      is_auto: true,
      created_by: user.id,
    })

    await logCommunityActivity(sb, circle.id, user.id, "community_created", "circle", circle.id, { name: circle.name })

    return NextResponse.json({ community: circle }, { status: 201 })
  } catch (e: any) {
    console.error("[communities] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to create community" }, { status: 500 })
  }
}