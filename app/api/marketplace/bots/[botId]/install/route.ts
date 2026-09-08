import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { isCommunityMember, newBotToken, logBotActivity } from "@/lib/bot-helpers"

export const dynamic = "force-dynamic"

/**
 * POST /api/marketplace/bots/[botId]/install
 * Body: { community_id }
 *
 * Installs a bot the user has *purchased* into one of their own communities
 * as a new instance (clone). The original listing and its creator keep full
 * ownership — the buyer just gets a working copy they can run and manage in
 * their community, which is what the marketplace is really about.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> },
) {
  try {
    const { botId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to install bots" }, { status: 401 })

    const supabase = createServerClient()
    const body = await request.json().catch(() => ({}))
    const communityId = String(body.community_id || "")
    if (!communityId) return NextResponse.json({ error: "Pick a community to install into" }, { status: 400 })

    const { data: bot } = await supabase
      .from("community_bots")
      .select("id, name, description, avatar_url, category, deployment_type, webhook_url, invite_link, source_url, auto_reply, commands, status, owner_id, community_id")
      .eq("id", botId)
      .maybeSingle()
    if (!bot) return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    if (bot.owner_id === user.id) return NextResponse.json({ error: "This is your own bot — it's already live in your community" }, { status: 400 })

    // Must have actually bought usage/source rights.
    const { data: purchase } = await supabase
      .from("bot_marketplace_purchases")
      .select("id, purchase_type")
      .eq("bot_id", botId)
      .eq("buyer_id", user.id)
      .maybeSingle()
    if (!purchase) {
      return NextResponse.json({ error: "Buy this bot first, then install it into your community" }, { status: 403 })
    }

    // Must be a member of the target community (owner/moderator can add bots).
    const member = await isCommunityMember(supabase, communityId, user.id)
    if (!member) return NextResponse.json({ error: "Join the community before installing bots there" }, { status: 403 })

    // Already installed this bot into this community?
    const { data: existing } = await supabase
      .from("community_bots")
      .select("id")
      .eq("community_id", communityId)
      .eq("owner_id", user.id)
      .eq("marketplace_source_id", botId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "This bot is already installed in that community" }, { status: 409 })
    }

    const secret = newBotToken()
    const { data: installed, error } = await supabase
      .from("community_bots")
      .insert({
        community_id: communityId,
        owner_id: user.id,
        marketplace_source_id: botId,
        name: bot.name,
        slug: `${bot.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}-${Date.now().toString(36)}`,
        description: bot.description || "",
        avatar_url: bot.avatar_url,
        category: bot.category || "utility",
        status: "online",
        deployment_type: bot.deployment_type || "hosted",
        webhook_url: bot.webhook_url || null,
        invite_link: bot.invite_link || null,
        source_url: bot.source_url || null,
        auto_reply: bot.auto_reply || null,
        commands: Array.isArray(bot.commands) ? bot.commands : [],
        secret_token: secret,
        is_listed: false,
      })
      .select(`*, owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified)`)
      .single()

    if (error || !installed) {
      if (String(error?.message || "").includes("duplicate")) {
        return NextResponse.json({ error: "A bot with this name already exists in that community — rename or remove it first" }, { status: 409 })
      }
      return NextResponse.json({ error: "Install failed — please try again" }, { status: 500 })
    }

    await logBotActivity(supabase, {
      bot_id: installed.id,
      community_id: communityId,
      actor_id: user.id,
      type: "created",
      title: `${installed.name} installed from the Marketplace`,
      message: `@${user.user_metadata?.username || "A member"} purchased ${purchase.purchase_type === "source" ? "the source" : "hosted access"} and installed ${installed.name} here. The original creator keeps ownership of the listing.`,
    })

    return NextResponse.json({
      success: true,
      bot: { ...installed, secret_token: undefined },
      secret_token: secret,
      message: `${bot.name} is now live in your community. Head to its Bots tab to chat with it.`,
    }, { status: 201 })
  } catch (e: any) {
    console.error("marketplace install error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
