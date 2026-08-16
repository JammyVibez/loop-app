import { notifyUsers } from "@/lib/notifications"

/**
 * Community bot runtime.
 *
 * Bots are configured per circle via the `circle_bots` table (installed from
 * the marketplace or created in the circle admin panel). Each bot carries a
 * `configuration` JSONB with its rules/messages.
 *
 *   Welcome bot    (bot_type "welcome")     — greets new members on join
 *   Moderation bot (bot_type "moderation")  — scans every chat message
 */

export async function getCircleBot(supabase: any, circleId: string, botType: string) {
  const { data } = await supabase
    .from("circle_bots")
    .select("*")
    .eq("circle_id", circleId)
    .eq("bot_type", botType)
    .eq("enabled", true)
    .maybeSingle()
  return data || null
}

/** Find the circle's general/public room so bots can speak into it. */
async function findGeneralRoom(supabase: any, circleId: string) {
  const { data: rooms } = await supabase
    .from("circle_rooms")
    .select("id, name, is_private, type")
    .eq("circle_id", circleId)
    .eq("is_private", false)
    .order("created_at", { ascending: true })
    .limit(10)
  const roomsList = rooms || []
  return (
    roomsList.find((r: any) => (r.name || "").toLowerCase().includes("general")) ||
    roomsList.find((r: any) => r.type !== "announcement") ||
    roomsList[0] ||
    null
  )
}

/** Pick the account the bot posts as (circle owner, else first admin). */
async function botAuthorId(supabase: any, circleId: string, fallbackId?: string) {
  const { data: circle } = await supabase.from("circles").select("owner_id").eq("id", circleId).maybeSingle()
  if (circle?.owner_id) return circle.owner_id
  const { data: admin } = await supabase
    .from("circle_members")
    .select("user_id")
    .eq("circle_id", circleId)
    .in("role", ["owner", "admin", "moderator"])
    .limit(1)
    .maybeSingle()
  return admin?.user_id || fallbackId || null
}

async function insertBotMessage(
  supabase: any,
  circleId: string,
  roomId: string,
  botName: string,
  content: string,
  fallbackAuthorId?: string,
) {
  const authorId = await botAuthorId(supabase, circleId, fallbackAuthorId)
  const { data, error } = await supabase
    .from("circle_room_messages")
    .insert({
      room_id: roomId,
      author_id: authorId || null,
      content,
      is_bot: true,
      bot_name: botName,
      moderation_status: "ok",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  return error ? null : data
}

/**
 * Welcome bot — fired when a member joins. Posts a greeting into the general
 * room and DMs the new member via notification.
 */
export async function runWelcomeBot(supabase: any, circleId: string, joinedUserId: string) {
  try {
    const bot = await getCircleBot(supabase, circleId, "welcome")
    if (!bot) return null

    const config = bot.configuration || {}
    const messages = config.messages || {}
    const { data: circle } = await supabase.from("circles").select("name").eq("id", circleId).maybeSingle()
    const { data: joined } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", joinedUserId)
      .maybeSingle()

    const name = joined?.display_name || joined?.username || "friend"
    const circleName = circle?.name || "the circle"
    const base = (messages.welcome as string) || `👋 Welcome to ${circleName}! Introduce yourself and join the fun.`
    const rules = (messages.rules as string) || (config.rules_message as string)
    const greeting = `${base}${rules ? `\n\n📌 ${rules}` : ""} — glad you're here, ${name}!`

    if (config.greet_in_general !== false) {
      const room = await findGeneralRoom(supabase, circleId)
      if (room) {
        await insertBotMessage(supabase, circleId, room.id, bot.name || "Welcome Bot", greeting, joinedUserId)
      }
    }

    // DM the new member so the greeting isn't missed.
    await notifyUsers(supabase, [joinedUserId], {
      type: "circle_join",
      title: `Welcome to ${circleName}! 👋`,
      message: greeting.replace(/\n+/g, " ").slice(0, 300),
      data: { circle_id: circleId, bot: bot.name || "Welcome Bot" },
    })

    return { greeted: true, bot_name: bot.name }
  } catch (error) {
    console.error("Welcome bot error:", error)
    return null
  }
}

const DEFAULT_BANNED_WORDS = ["scam", "click here", "free coins", "dm me now", "buy followers"]

/** Rule check — returns a violation reason or null. */
export function checkModerationRules(text: string, config: Record<string, any>): string | null {
  const mod = config.moderation || config.rules || {}
  const banned = Array.isArray(mod.banned_words) && mod.banned_words.length ? mod.banned_words : DEFAULT_BANNED_WORDS
  const lower = ` ${text.toLowerCase()} `

  for (const word of banned) {
    const w = String(word || "").trim().toLowerCase()
    if (w && lower.includes(` ${w} `)) return `contains blocked term "${w}"`
  }

  const maxLinks = Number(mod.max_links_per_message ?? 3)
  const links = (text.match(/https?:\/\/[^\s]+/g) || []).length
  if (links > maxLinks) return `contains ${links} links (max ${maxLinks})`

  const maxMentions = Number(mod.max_mentions_per_message ?? 10)
  const mentions = (text.match(/@[a-zA-Z0-9_]{2,}/g) || []).length
  if (mentions > maxMentions) return `mentions too many users (${mentions})`

  return null
}

/**
 * Moderation bot — fired after every chat message. Flags or removes messages
 * that violate rules, warns the author, and notifies the circle's mods.
 */
export async function runModerationBot(
  supabase: any,
  circleId: string,
  roomId: string,
  message: { id: string; content: string; author_id: string | null },
) {
  try {
    const bot = await getCircleBot(supabase, circleId, "moderation")
    if (!bot) return null

    const config = bot.configuration || {}
    const mod = config.moderation || config.rules || {}
    const text = String(message.content || "").trim()
    if (!text) return null

    const violation = checkModerationRules(text, config)
    if (!violation) return null

    const shouldDelete = mod.delete_message !== false && config.auto_remove !== false
    const shouldWarn = mod.warn_user !== false && config.warn_user !== false

    if (shouldDelete) {
      await supabase
        .from("circle_room_messages")
        .update({
          moderation_status: "removed",
          moderation_reason: violation,
          content: "",
          updated_at: new Date().toISOString(),
        })
        .eq("id", message.id)
    } else {
      await supabase
        .from("circle_room_messages")
        .update({
          moderation_status: "flagged",
          moderation_reason: violation,
          updated_at: new Date().toISOString(),
        })
        .eq("id", message.id)
    }

    const botName = bot.name || "Moderation Bot"

    // Warn the author.
    if (shouldWarn && message.author_id) {
      await notifyUsers(supabase, [message.author_id], {
        type: "moderation",
        title: "⚠️ Message removed by Moderation Bot",
        message: (config.messages?.warning as string) || `Your message was removed (${violation}). Please keep messages respectful.`,
        data: { circle_id: circleId, reason: violation },
      })
    }

    // Notify the circle's moderators so a human can follow up.
    if (mod.notify_moderators !== false && config.notify_moderators !== false) {
      const { data: mods } = await supabase
        .from("circle_members")
        .select("user_id")
        .eq("circle_id", circleId)
        .eq("status", "active")
        .in("role", ["owner", "admin", "moderator"])
      const modIds = ((mods || []) as Array<{ user_id: string }>)
        .map((m) => m.user_id)
        .filter((id) => id !== message.author_id)
      if (modIds.length > 0) {
        await notifyUsers(supabase, modIds, {
          type: "moderation",
          title: `🛡️ ${botName} flagged a message`,
          message: `A message was removed in your circle (${violation}).`,
          data: { circle_id: circleId, room_id: roomId, reason: violation },
        })
      }
    }

    // Post a public bot notice so the room stays transparent.
    const notice = (config.messages?.removed_notice as string) || "🛡️ A message was removed by Moderation Bot for violating the circle rules."
    await insertBotMessage(supabase, circleId, roomId, botName, notice, message.author_id ?? undefined)

    return { flagged: true, reason: violation, removed: shouldDelete }
  } catch (error) {
    console.error("Moderation bot error:", error)
    return null
  }
}
