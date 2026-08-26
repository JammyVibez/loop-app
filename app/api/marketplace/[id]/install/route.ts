import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

export const dynamic = "force-dynamic"

async function getAuthedUser(request: NextRequest) {
  if (!token) return null
  const supabase = createServerClient()
  const user = await getUserFromRequest(request)
  if (!user) return null
  return user
}

function canManage(role?: string | null) {
  return role === "owner" || role === "admin" || role === "moderator"
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthedUser(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const circleId = body.circle_id as string | undefined
    if (!circleId) {
      return NextResponse.json({ error: "circle_id is required to install" }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: listing, error: listingError } = await supabase
      .from("community_marketplace_listings")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (listingError || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    const isSeller = listing.seller_id === user.id
    if (!isSeller) {
      const { data: purchase } = await supabase
        .from("community_marketplace_purchases")
        .select("id")
        .eq("listing_id", id)
        .eq("buyer_id", user.id)
        .maybeSingle()

      if (!purchase && (listing.price_coins || 0) > 0) {
        return NextResponse.json({ error: "Purchase this listing before installing" }, { status: 403 })
      }
    }

    const { data: member } = await supabase
      .from("circle_members")
      .select("role, status")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!canManage(member?.role) || member?.status === "banned") {
      return NextResponse.json({ error: "Only circle admins can install marketplace packs" }, { status: 403 })
    }

    const payload = (listing.payload || {}) as Record<string, any>
    let installResult: Record<string, unknown> = { listing_type: listing.listing_type }

    if (listing.listing_type === "bot") {
      const botType = payload.bot_type || "custom"
      const { data: bot, error: botError } = await supabase
        .from("circle_bots")
        .upsert(
          {
            circle_id: circleId,
            name: payload.name || listing.title,
            bot_type: botType,
            enabled: true,
            configuration: {
              ...(payload.configuration || {}),
              marketplace_listing_id: listing.id,
              triggers: payload.triggers || [],
              messages: payload.messages || {},
              logic: payload.logic || {},
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "circle_id,bot_type" },
        )
        .select("*")
        .single()

      if (botError) {
        return NextResponse.json({ error: botError.message || "Failed to install bot" }, { status: 500 })
      }
      installResult = { ...installResult, bot }
    } else if (listing.listing_type === "design" || listing.listing_type === "styling") {
      const { data: circle } = await supabase
        .from("circles")
        .select("settings")
        .eq("id", circleId)
        .maybeSingle()

      const settings = {
        ...((circle?.settings as Record<string, unknown>) || {}),
        marketplace: {
          ...(((circle?.settings as any)?.marketplace as object) || {}),
          [listing.listing_type]: {
            listing_id: listing.id,
            title: listing.title,
            applied_at: new Date().toISOString(),
            ...payload,
          },
        },
        community_studio: {
          ...(((circle?.settings as any)?.community_studio as object) || {}),
          enabled: true,
          layout: payload.layout || ((circle?.settings as any)?.community_studio?.layout) || "default",
          theme: payload.theme || ((circle?.settings as any)?.community_studio?.theme) || "marketplace",
          accent:
            payload.css_variables?.["--circle-accent"] ||
            payload.colors?.secondary ||
            payload.colors?.primary ||
            ((circle?.settings as any)?.community_studio?.accent) ||
            "#22d3ee",
          source_listing_id: listing.id,
        },
      }

      const { error: circleError } = await supabase
        .from("circles")
        .update({ settings, updated_at: new Date().toISOString() })
        .eq("id", circleId)

      if (circleError) {
        return NextResponse.json({ error: circleError.message || "Failed to apply design" }, { status: 500 })
      }

      installResult = { ...installResult, settings }
    } else {
      return NextResponse.json({ error: "Unsupported listing type" }, { status: 400 })
    }

    const { data: install } = await supabase
      .from("community_marketplace_installs")
      .insert({
        listing_id: id,
        user_id: user.id,
        circle_id: circleId,
        install_result: installResult,
      })
      .select("*")
      .single()

    return NextResponse.json({ success: true, install, result: installResult })
  } catch (error) {
    console.error("Marketplace install error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
