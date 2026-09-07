import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getBot, logBotActivity } from "@/lib/bot-helpers"

export const dynamic = "force-dynamic"

/**
 * POST /api/bots/[botId]/webhook — called BY the bot's own hosting (or the
 * bot runtime) to report back into Loop. Authenticated with x-bot-secret,
 * so only the real bot / its owner can push data.
 *
 * Body events:
 *  { event: "status", status: "online"|"offline" }
 *  { event: "activity", type, title, message }
 *  { event: "message", content }            → bot replies in community chat
 *  { event: "commands", commands: string[] }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params
    const supabase = createServerClient()
    const bot = await getBot(supabase, botId)
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 })

    const provided = request.headers.get("x-bot-secret") || new URL(request.url).searchParams.get("token") || ""
    if (!provided || provided !== bot.secret_token) {
      return NextResponse.json({ error: "Invalid bot secret" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const event = String(body.event || "activity")
    const now = new Date().toISOString()

    if (event === "status") {
      const status = body.status === "online" ? "online" : "offline"
      await supabase
        .from("community_bots")
        .update({ status, last_active_at: status === "online" ? now : bot.last_active_at, updated_at: now })
        .eq("id", botId)
      await logBotActivity(supabase, {
        bot_id: botId,
        community_id: bot.community_id,
        actor_id: bot.owner_id,
        type: "status",
        title: `${bot.name} is ${status === "online" ? "online" : "offline"}`,
        message: `Status reported by the bot runtime (${status}).`,
      })
      return NextResponse.json({ success: true })
    }

    if (event === "message") {
      const content = String(body.content || "").trim().slice(0, 1000)
      if (!content) return NextResponse.json({ error: "content required" }, { status: 400 })
      const { error } = await supabase.from("bot_chat_messages").insert({
        bot_id: botId,
        community_id: bot.community_id,
        user_id: null,
        role: "bot",
        content,
      })
      if (error) return NextResponse.json({ error: "Failed to store message" }, { status: 500 })
      await supabase
        .from("community_bots")
        .update({ last_active_at: now, status: "online", updated_at: now })
        .eq("id", botId)
      return NextResponse.json({ success: true })
    }

    if (event === "commands") {
      const commands = Array.isArray(body.commands) ? body.commands.map(String).slice(0, 50) : []
      await supabase.from("community_bots").update({ commands, updated_at: now }).eq("id", botId)
      return NextResponse.json({ success: true, commands: commands.length })
    }

    // Default: log an activity entry.
    await logBotActivity(supabase, {
      bot_id: botId,
      community_id: bot.community_id,
      actor_id: bot.owner_id,
      type: String(body.type || "custom").slice(0, 40),
      title: String(body.title || `${bot.name} activity`).slice(0, 120),
      message: String(body.message || "").slice(0, 500) || null,
    })
    await supabase
      .from("community_bots")
      .update({ last_active_at: now, status: "online", updated_at: now })
      .eq("id", botId)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error("bot webhook error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}