import { logBotActivity } from "@/lib/bot-helpers"

/**
 * Built-in bot skills — what a Loop bot can do on its own without an
 * external webhook. These make marketplace bots genuinely useful the moment
 * they're installed: moderation bots log real warnings/mutes/purges into the
 * community's bot activity feed, and store/reward bots read and grant real
 * Loop Coins (with an anti-farming daily claim table).
 *
 * Bots with their own webhook keep full control; this only runs when no
 * live hosting answered (or no webhook is configured).
 */

const DAILY_REWARD = 25

interface SkillContext {
  bot: any
  supabase: any
  user: { id: string; name?: string; user_metadata?: Record<string, any> | null }
  communityId: string
}

function displayName(ctx: SkillContext): string {
  return (
    ctx.user.user_metadata?.display_name ||
    ctx.user.user_metadata?.username ||
    ctx.user.name ||
    "A member"
  )
}

async function log(ctx: SkillContext, type: string, title: string, message: string) {
  await logBotActivity(ctx.supabase, {
    bot_id: ctx.bot.id,
    community_id: ctx.communityId,
    actor_id: ctx.user.id,
    type,
    title,
    message,
  })
}

function helpText(ctx: SkillContext): string {
  const commands = Array.isArray(ctx.bot.commands) ? ctx.bot.commands.filter(Boolean) : []
  const lines = [
    `**${ctx.bot.name} — available commands**`,
    ...(commands.length > 0 ? commands.map((c: string) => `• ${c}`) : ["• /help — show this list"]),
    "Type a command to use me. For custom logic, the owner can point me at their own webhook.",
  ]
  return lines.join("\n")
}

export async function runBotSkill(ctx: SkillContext, rawContent: string): Promise<string | null> {
  const content = String(rawContent || "").trim()
  if (!content) return null

  const lower = content.toLowerCase()
  const first = (lower.split(/\s+/)[0] || "").toLowerCase()
  const rest = content.trim().slice(first.length).trim()
  const category = String(ctx.bot.category || "custom").toLowerCase()

  // ── Help ─────────────────────────────────────────────────────────────
  if (first === "/help" || first === "help") return helpText(ctx)
  if (first === "/start" || first === "/menu") return helpText(ctx)

  // ── Moderation bots (LoopGuard & friends) ─────────────────────────────
  if (category === "moderation") {
    if (first === "/rules" || first === "/ruleset") {
      return [
        `I enforce ${ctx.bot.name || "this community's"} moderation pack:`,
        "• /warn @user <reason> — record a formal warning",
        "• /mute @user <time> — restrict a member",
        "• /unmute @user — lift a restriction",
        "• /purge <n> — flag recent messages for review",
        "• /filter <word> — suggest a word filter to moderators",
        "Every action is logged to the community's activity feed so admins can audit it.",
      ].join("\n")
    }
    if (first === "/warn") {
      const target = rest.split(/\s+/)[0] || ""
      const reason = rest.slice(target.length).trim() || "No reason given"
      if (!target) {
        return "Usage: /warn @username <reason> — I'll log the warning for your moderators."
      }
      await log(ctx, "moderation", `⚠️ Warned ${target}`, `${displayName(ctx)} warned ${target}: ${reason}`)
      return `Warning logged for ${target} (reason: ${reason}). Moderators can see it in the activity feed — for automatic enforcement, ask the owner to connect a moderation webhook.`
    }
    if (first === "/mute") {
      const parts = rest.split(/\s+/)
      const target = parts[0] || ""
      const time = parts[1] || "24h"
      if (!target) {
        return "Usage: /mute @username <time> — I'll log the mute request for your moderators."
      }
      await log(ctx, "moderation", `🔇 Mute request: ${target}`, `${displayName(ctx)} requested a ${time} mute for ${target}.`)
      return `Mute request logged for ${target} (${time}). Apply it from the community's Members tab, or ask the owner to wire live moderation.`
    }
    if (first === "/unmute") {
      const target = rest.split(/\s+/)[0] || ""
      if (!target) return "Usage: /unmute @username"
      await log(ctx, "moderation", `🔊 Unmute request: ${target}`, `${displayName(ctx)} requested ${target} be unmuted.`)
      return `Unmute request logged for ${target}.`
    }
    if (first === "/purge") {
      const n = Number.parseInt(rest.split(/\s+/)[0] || "", 10)
      const count = Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 10
      await log(ctx, "moderation", `🧹 Purge flagged (${count})`, `${displayName(ctx)} asked to purge up to ${count} recent messages.`)
      return `Noted — up to ${count} recent messages flagged for moderator review. In the feed these would be removed instantly once I'm connected to moderation actions.`
    }
    if (first === "/filter") {
      const word = rest.split(/\s+/)[0] || ""
      if (!word) return "Usage: /filter <word> — suggest a filtered word."
      await log(ctx, "moderation", `🚫 Filter suggestion: ${word}`, `${displayName(ctx)} suggested filtering “${word}”.`)
      return `Filter suggestion logged for “${word}”. Moderators can enable it in community settings.`
    }
  }

  // ── Store / reward bots (CoinKeeper & friends) ────────────────────────
  const isStoreBot = category === "ecommerce" || category === "games" || /coin|keeper|shop|store|reward/i.test(String(ctx.bot.name || ""))

  if (isStoreBot) {
    if (first === "/balance" || first === "/coins") {
      const { data: profile } = await ctx.supabase
        .from("profiles")
        .select("loop_coins")
        .eq("id", ctx.user.id)
        .maybeSingle()
      const coins = Number(profile?.loop_coins ?? 0)
      return `${displayName(ctx)}, your balance is **${coins.toLocaleString()} Loop Coins**. Earn more with /daily, or browse /shop.`
    }
    if (first === "/daily") {
      const { data: existing } = await ctx.supabase
        .from("bot_daily_claims")
        .select("id")
        .eq("bot_id", ctx.bot.id)
        .eq("user_id", ctx.user.id)
        .gte("claim_date", new Date().toISOString().slice(0, 10))
        .maybeSingle()
      if (existing) {
        const { data: bal } = await ctx.supabase.from("profiles").select("loop_coins").eq("id", ctx.user.id).maybeSingle()
        return `You already claimed today's ${DAILY_REWARD} coins. Check back tomorrow! Current balance: **${Number(bal?.loop_coins ?? 0).toLocaleString()}** coins.`
      }
      const { data: profile } = await ctx.supabase.from("profiles").select("loop_coins").eq("id", ctx.user.id).maybeSingle()
      const current = Number(profile?.loop_coins ?? 0)
      const { error: claimErr } = await ctx.supabase.from("bot_daily_claims").insert({
        bot_id: ctx.bot.id,
        community_id: ctx.communityId,
        user_id: ctx.user.id,
        claim_date: new Date().toISOString().slice(0, 10),
        amount: DAILY_REWARD,
      })
      if (claimErr) {
        if (String(claimErr.message || "").includes("duplicate")) {
          return `You already claimed today's ${DAILY_REWARD} coins. Check back tomorrow!`
        }
        return "Couldn't process your claim — try again in a moment."
      }
      await ctx.supabase
        .from("profiles")
        .update({ loop_coins: current + DAILY_REWARD, updated_at: new Date().toISOString() })
        .eq("id", ctx.user.id)
      await log(ctx, "reward", `${DAILY_REWARD} coins claimed`, `${displayName(ctx)} claimed a daily reward of ${DAILY_REWARD} coins.`)
      return `Daily reward claimed! **+${DAILY_REWARD} coins** → new balance **${(current + DAILY_REWARD).toLocaleString()}** coins. Come back tomorrow for another drop.`
    }
    if (first === "/shop" || first === "/store") {
      const items = [
        { name: "Pro Week trial", price: 750 },
        { name: "Golden name glow", price: 1200 },
        { name: "Premium PFP frame", price: 2000 },
        { name: "Community raid shoutout", price: 3200 },
      ]
      const lines = [`**${ctx.bot.name} Storefront** — pay with /balance coins:`, ...items.map((i) => `• ${i.name} — ${i.price.toLocaleString()} coins`)]
      lines.push("To actually run a store with live inventory, the owner connects a webhook — until then I keep a demo catalog.")
      return lines.join("\n")
    }
    if (first === "/giveaway" || first === "/raffle") {
      await log(ctx, "reward", `🎉 Giveaway request`, `${displayName(ctx)} started a giveaway request.`)
      return `Giveaway noted! To run a real draw, the owner connects this bot to the community — I'll announce winners and pay out in coins automatically.`
    }
    if (first === "/redeem") {
      return "Redeem codes require the owner to connect a store webhook. Send your code anyway — I'll log it."
    }
  }

  // ── Welcome / notification helpers ────────────────────────────────────
  if (category === "welcome") {
    if (/hello|hi\b|hey|yo\b/i.test(lower)) {
      return `Hey ${displayName(ctx)}! 👋 I handle welcomes here. Type /help to see what I can do — owners can wire me to greet every new member automatically.`
    }
    if (first === "/greet") {
      await log(ctx, "welcome", `👋 Greeting test`, `${displayName(ctx)} tested the welcome message.`)
      return `Welcome message test logged. When connected to join events I'll greet new members in the feed automatically.`
    }
  }
  if (category === "notification" || category === "utility") {
    if (first === "/status") {
      const now = new Date()
      return `${ctx.bot.name} is **online** and listening. Uptime: managed by Loop · Last activity ${now.toLocaleTimeString()}. Type /help for commands.`
    }
  }

  // ── Games / AI / custom: small personality helpers ────────────────────
  if (first === "/version") {
    return `${ctx.bot.name} v1.0 — Loop Bot Runtime · built-in skills enabled. Owners can extend me with a webhook.`
  }
  if (first === "/ping") {
    return "Pong! ⚡ I'm alive and replying from Loop."
  }

  // Unknown slash command → list what this bot can do.
  if (first.startsWith("/")) {
    return `I don't have a “${first}” skill yet. ${helpText(ctx)}`
  }

  return null
}

export { DAILY_REWARD }
