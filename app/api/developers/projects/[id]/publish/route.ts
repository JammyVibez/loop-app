import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const LISTING_TYPES = new Set(["design", "styling", "bot"])

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const listingType = String(body.listing_type || "")
    if (!LISTING_TYPES.has(listingType)) {
      return NextResponse.json({ error: "listing_type must be design, styling, or bot" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: project } = await supabase
      .from("developer_projects")
      .select("id, author_id, title, description, language, framework, tags, repository_url, demo_url, code_snippet, published_listing_id")
      .eq("id", projectId)
      .maybeSingle()

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
    if (project.author_id !== user.id) {
      return NextResponse.json({ error: "Only the project author can publish it" }, { status: 403 })
    }

    // Already published? Return the existing listing so the UI can link to it.
    if (project.published_listing_id) {
      const { data: existing } = await supabase
        .from("community_marketplace_listings")
        .select("id, listing_type, title, price_coins, is_published")
        .eq("id", project.published_listing_id)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ success: true, already_published: true, listing: existing })
      }
    }

    const priceCoins = Math.max(0, Number(body.price_coins) || 0)
    const tags = Array.isArray(body.tags)
      ? body.tags.map(String).filter(Boolean).slice(0, 10)
      : Array.isArray(project.tags) && project.tags.length
        ? project.tags.slice(0, 10)
        : []

    // Payload carries enough of the project through to the installer.
    const payload: Record<string, unknown> = {
      developer_project_id: project.id,
      language: project.language,
      framework: project.framework || "None",
      repository_url: project.repository_url,
      demo_url: project.demo_url,
    }

    if (listingType === "bot") {
      Object.assign(payload, {
        bot_type: "custom",
        name: project.title,
        configuration: {
          tone: "helpful",
          source_project_id: project.id,
        },
        triggers: ["member_join"],
        messages: {
          welcome: `${project.title} bot is now live — ask it anything!`,
        },
        logic: { cooldown_minutes: 5, max_replies_per_hour: 60 },
      })
    } else {
      Object.assign(payload, {
        title: project.title,
        description: project.description,
        code_snippet: project.code_snippet ? project.code_snippet.slice(0, 8000) : null,
        design_source: "developer_project",
      })
    }

    const { data: listing, error } = await supabase
      .from("community_marketplace_listings")
      .insert({
        seller_id: user.id,
        listing_type: listingType,
        title: String(body.title || "").trim() || `${project.title}`,
        description: String(body.description || "").trim() || project.description || null,
        price_coins: priceCoins,
        payload,
        tags,
        is_published: body.is_published !== false,
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        seller:profiles!community_marketplace_listings_seller_id_fkey(
          id, username, display_name, avatar_url
        )
      `,
      )
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await supabase.from("developer_projects").update({ published_listing_id: listing.id }).eq("id", project.id)

    return NextResponse.json({ success: true, listing }, { status: 201 })
  } catch (error) {
    console.error("Publish project to marketplace error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
