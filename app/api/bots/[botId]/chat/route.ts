import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { getBot, isCommunityMember, canModerateCommunity, logBotActivity } from "@/lib/bot-helpers"

export const dynamic = "force-dynamic"

/** GET /api/bots/[botId]/chat — recent conversation between the community and the bot. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    const bot = await getBot(supabase, botId)
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })

    const canUse = user ? await isCommunityMember(supabase, bot.community_id, user.id) : false
    const canMod = user ? await canModerateCommunity(supabase, bot.community_id, user.id) : false
    if (!canUse && !canMod && bot.owner_id !== user?.id) {
      return NextResponse.json({ error: "Members only" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100)

    const { data, error } = await supabase
      .from("bot_chat_messages")
      .select(`
        *,
        sender:profiles!user_id(id, username, display_name, avatar_url)
      `)
      .eq("bot_id", botId)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
    return NextResponse.json({ success: true, messages: data || [] })
  } catch (e: any) {
    console.error("bot chat GET error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/bots/[botId]/chat — send a message to the bot.
 * If the bot has a webhook_url it is forwarded to the owner's hosting
 * (event: "message"). Otherwise the bot's built-in auto_reply answers.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()
    const bot = await getBot(supabase, botId)
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })

    const canUse = await isCommunityMember(supabase, bot.community_id, user.id)
    const canMod = await canModerateCommunity(supabase, bot.community_id, user.id)
    if (!canUse && !canMod && bot.owner_id !== user.id) {
      return NextResponse.json({ error: "Join the community to talk to this bot" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const content = String(body.content || "").trim()
    if (!content || content.length > 1000) {
      return NextResponse.json({ error: "Message is required (max 1000 characters)" }, { status: 400 })
    }

    const { error } = await supabase.from("bot_chat_messages").insert({
      bot_id: botId,
      community_id: bot.community_id,
      user_id: user.id,
      role: "user",
      content,
    })
    if (error) return NextResponse.json({ error: "Failed to send message" }, { status: 500 })

    let reply: string | null = null
    let delivered = false

    // 1) Live bot: forward to the owner's webhook (fire-and-forget).
    if (bot.webhook_url && /^https?:\/\//.test(bot.webhook_url)) {
      try {
        const res = await fetch(bot.webhook_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-bot-secret": bot.secret_token,
            "x-bot-event": "message",
          },
          body: JSON.stringify({
            event: "message",
            bot_id: botId,
            community_id: bot.community_id,
            user: {
              id: user.id,
              username: user.user_metadata?.username || user.name || "",
              display_name: user.user_metadata?.display_name || user.name || "",
            },
            content,
          }),
          signal: AbortSignal.timeout(6000),
        })
        delivered = res.ok
        if (delivered) {
          const data = await res.json().catch(() => null)
          reply = typeof data?.reply === "string" && data.reply.trim() ? data.reply.trim().slice(0, 1000) : null
        }
      } catch {
        delivered = false
      }
    }

    // 2) Built-in reply fallback (bots without hosting still feel alive).
    if (!reply && bot.auto_reply) {
      reply = bot.auto_reply.slice(0, 1000)
    }

    if (reply) {
      await supabase.from("bot_chat_messages").insert({
        bot_id: botId,
        community_id: bot.community_id,
        user_id: null,
        role: "bot",
        content: reply,
      })
      await logBotActivity(supabase, {
        bot_id: botId,
        community_id: bot.community_id,
        actor_id: bot.owner_id,
        type: "command",
        title: `${bot.name} replied`,
        message: `Answered ${user.user_metadata?.display_name || user.user_metadata?.username || user.name || "a member"} in chat.`,
      })
      await supabase
        .from("community_bots")
        .update({ last_active_at: new Date().toISOString(), status: "online", updated_at: new Date().toISOString() })
        .eq("id", botId)
    } else if (!delivered && !bot.webhook_url) {
      // Nothing to answer with and no webhook — still log the interaction.
      await logBotActivity(supabase, {
        bot_id: botId,
        community_id: bot.community_id,
        actor_id: user.id,
        type: "command",
        title: `Message sent to ${bot.name}`,
        message: `${user.user_metadata?.display_name || user.user_metadata?.username || user.name || "A member"} said “${content.slice(0, 120)}”.`,
      })
    }

    return NextResponse.json({ success: true, reply, delivered })
  } catch (e: any) {
    console.error("bot chat POST error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}