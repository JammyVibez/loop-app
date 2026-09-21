/**
 * Single source of truth for how a notification is worded in the UI.
 *
 * Before this, the dropdown guessed a verb from `type` and fell back to
 * "interacted with your post" for anything it didn't recognise — so coin
 * rewards, announcements, live streams and admin actions all rendered as if
 * somebody had interacted with a post. Every type now has its own copy, and
 * platform-originated notifications read as coming from Loop itself.
 */

/** Notifications the platform sends on its own behalf — never an admin. */
export const SYSTEM_SENDER = "Loop"

/** Types with no human actor: they carry their own title from the platform. */
const SYSTEM_TYPES = new Set([
  "system",
  "announcement",
  "broadcast",
  "admin_action",
  "admin_broadcast",
  "admin_report_created",
  "moderation",
  "purchase",
  "payment",
  "payout",
  "reward",
  "award",
  "coin_reward",
  "coin_grant",
  "coins_earned",
  "pro_grant",
  "trending",
  "feature_announcement",
  "account_update",
  "verification",
  "weekly_bonus",
  "daily_claim",
])

export function isSystemNotificationType(type?: string | null) {
  if (!type) return false
  return SYSTEM_TYPES.has(type) || type.startsWith("admin_") || type.startsWith("system")
}

const ADMIN_WORDS =
  /\b(?:site\s+|platform\s+|loop\s+)?(?:admins?|administrators?|moderators?|mod\s+team|moderation\s+team|staff|support\s+team)\b/gi

/**
 * Strip any trace of manual admin involvement from platform copy.
 * "An admin gave you 100 coins" → "You received 100 coins from Loop".
 */
export function maskAdminCopy(text: string): string {
  if (!text) return text
  let out = String(text)

  // Phrasings that name the actor outright — rewrite before the generic pass.
  out = out.replace(/\b(?:an?|the)\s+(?:site\s+|platform\s+)?admin[s]?\b/gi, SYSTEM_SENDER)
  out = out.replace(/\bby\s+(?:an?\s+)?(?:site\s+|platform\s+)?admin[s]?\b/gi, `by ${SYSTEM_SENDER}`)
  out = out.replace(/\b(?:site\s+|platform\s+)?admins?\s+gave\b/gi, `${SYSTEM_SENDER} gave`)
  out = out.replace(/\b(?:site\s+|platform\s+)?admins?\s+granted\b/gi, `${SYSTEM_SENDER} granted`)
  out = out.replace(/\b(?:site\s+|platform\s+)?admins?\s+sent\b/gi, `${SYSTEM_SENDER} sent`)
  out = out.replace(/\b(?:site\s+|platform\s+)?admins?\s+added\b/gi, `${SYSTEM_SENDER} added`)
  out = out.replace(ADMIN_WORDS, SYSTEM_SENDER)

  return out.replace(/\s{2,}/g, " ").trim()
}

export type NotificationCopyInput = {
  type?: string | null
  /** The record's own title (used verbatim for platform notifications). */
  title?: string | null
  message?: string | null
  /** Display name / username of the single actor. */
  actorName?: string | null
  /** Grouped notifications: how many people, and who else. */
  groupCount?: number
  otherActorsLabel?: string | null
}

export type NotificationCopy = {
  /** Who the notification is from — a person's name, or "Loop". */
  sender: string
  /** Reads directly after the sender, e.g. "liked your post". */
  action: string
  /** Platform copy instead of a person's action — render sender as a badge. */
  system: boolean
}

/** Action copy per notification type, written to follow the sender's name. */
const ACTION_BY_TYPE: Record<string, string> = {
  like: "liked your post",
  circle_post_like: "liked your community post",
  comment: "commented on your post",
  circle_post_comment: "commented on your community post",
  reply: "replied to your post",
  mention: "mentioned you",
  branch: "branched your post",
  boost: "boosted your post",
  follow: "started following you",
  follow_request: "requested to follow you",
  gift: "sent you a gift",
  gift_received: "sent you a gift",
  message: "sent you a message",
  chat_message: "sent you a message",
  circle_join: "joined your Circle",
  circle_join_request: "asked to join your Circle",
  circle_join_approved: "approved your request to join",
  co_loop_invite: "invited you to a Co-Loop",
  co_loop_open_join: "joined your Co-Loop",
  call_incoming: "is calling you",
  live_stream_started: "went live",
  creator_live: "went live",
  clutch_duel_result: "posted a Duel result",
}

/**
 * Build the sentence pieces for one notification.
 * Platform notifications keep their own title/message and are attributed to
 * Loop — they never fall back to a post-interaction verb.
 */
export function getNotificationCopy(input: NotificationCopyInput): NotificationCopy {
  const type = (input.type || "").toLowerCase()

  if (isSystemNotificationType(type)) {
    const title = maskAdminCopy(String(input.title || "").trim())
    const message = maskAdminCopy(String(input.message || "").trim())
    return {
      sender: SYSTEM_SENDER,
      action: title || message || "You have a new update",
      system: true,
    }
  }

  const grouped = (input.groupCount || 1) > 1
  const sender = grouped
    ? input.groupCount === 2
      ? `${input.actorName || "Someone"} and ${input.otherActorsLabel || "someone"}`
      : `${input.actorName || "Someone"} and ${(input.groupCount || 1) - 1} others`
    : input.actorName || ""

  const action = ACTION_BY_TYPE[type]

  if (action) {
    return { sender, action: grouped ? action : action, system: false }
  }

  // Unknown type: prefer the notification's own title over a wrong guess.
  const fallback = maskAdminCopy(String(input.title || input.message || "").trim())
  return {
    sender: fallback ? SYSTEM_SENDER : sender,
    action: fallback || "sent you a notification",
    system: Boolean(fallback),
  }
}
