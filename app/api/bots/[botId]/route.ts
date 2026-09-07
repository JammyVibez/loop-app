import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { getBot, isCommunityMember, canModerateCommunity, logBotActivity } from "@/lib/bot-helpers"

export const dynamic = "force-dynamic"

/** GET /api/bots/[botId] — bot detail + recent activity + permission flags. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)

    const bot = await getBot(supabase, botId)
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })

    const canUse = user ? await isCommunityMember(supabase, bot.community_id, user.id) : false
    const canManage = Boolean(user && bot.owner_id === user.id)
    const canModerate = user ? await canModerateCommunity(supabase, bot.community_id, user.id) : false

    if (!canUse && !canManage && !canModerate) {
      return NextResponse.json({ error: "Members only" }, { status: 403 })
    }

    const { data: activity } = await supabase
      .from("bot_activity")
      .select(`
        *,
        actor:profiles!actor_id(id, username, display_name, avatar_url)
      `)
      .eq("bot_id", botId)
      .order("created_at", { ascending: false })
      .limit(30)

    return NextResponse.json({
      success: true,
      bot: { ...bot, secret_token: canManage ? bot.secret_token : undefined },
      activity: activity || [],
      canManage,
      canUse,
    })
  } catch (e: any) {
    console.error("bot detail error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/bots/[botId] — owner-only update.
 * The owner's secret token is required to touch anything, so the bot can
 * never be taken over or reconfigured by someone else (even a community admin).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const bot = await getBot(supabase, botId)
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })
    if (bot.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the creator can manage this bot" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const providedSecret = String(body.secret_token || "")
    if (!providedSecret || providedSecret !== bot.secret_token) {
      return NextResponse.json({ error: "Bot secret token required to make changes" }, { status: 403 })
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() }

    if (typeof body.name === "string") {
      const name = body.name.trim()
      if (!name || name.length > 60) return NextResponse.json({ error: "Name is required" }, { status: 400 })
      patch.name = name
    }
    if (typeof body.description === "string") patch.description = body.description.slice(0, 500)
    if (typeof body.avatar_url === "string") patch.avatar_url = body.avatar_url || null
    if (typeof body.category === "string") patch.category = body.category.slice(0, 40)
    if (typeof body.webhook_url === "string") patch.webhook_url = body.webhook_url || null
    if (typeof body.invite_link === "string") patch.invite_link = body.invite_link || null
    if (typeof body.source_url === "string") patch.source_url = body.source_url || null
    if (typeof body.auto_reply === "string") patch.auto_reply = body.auto_reply.slice(0, 500) || null
    if (typeof body.status === "string") patch.status = body.status === "online" ? "online" : "offline"
    if (typeof body.deployment_type === "string") patch.deployment_type = body.deployment_type === "source" ? "source" : "hosted"
    if (Array.isArray(body.commands)) patch.commands = body.commands.map(String).slice(0, 50)
    if (typeof body.regenerate_secret === "boolean" && body.regenerate_secret) {
      patch.secret_token = crypto.randomUUID()
    }

    const { data: updated, error } = await supabase
      .from("community_bots")
      .update(patch)
      .eq("id", botId)
      .select(`*, owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified)`)
      .single()

    if (error) return NextResponse.json({ error: "Failed to update bot" }, { status: 500 })

    await logBotActivity(supabase, {
      bot_id: botId,
      community_id: bot.community_id,
      actor_id: user.id,
      type: "status",
      title: `${updated.name} updated`,
      message: "Settings changed by the creator.",
    })

    return NextResponse.json({
      success: true,
      bot: updated,
      secret_token: patch.secret_token || undefined,
    })
  } catch (e: any) {
    console.error("update bot error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** DELETE /api/bots/[botId] — owner + secret required. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const bot = await getBot(supabase, botId)
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const providedSecret = searchParams.get("secret") || ""
    const isOwner = bot.owner_id === user.id
    const isMod = await canModerateCommunity(supabase, bot.community_id, user.id)
    if (!isOwner && !isMod) {
      return NextResponse.json({ error: "Only the creator or community staff can remove this bot" }, { status: 403 })
    }
    if (isOwner && providedSecret !== bot.secret_token) {
      return NextResponse.json({ error: "Bot secret token required" }, { status: 403 })
    }

    await supabase.from("community_bots").delete().eq("id", botId)
    return NextResponse.json({ success: true, message: `${bot.name} removed` })
  } catch (e: any) {
    console.error("delete bot error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}