/**
 * Global content moderation pipeline.
 * Layered approach: regex patterns → keyword lists → API calls (optional).
 * Runs on both client (pre-submit) and server (post-submit).
 */

// ─── Spam Detection ────────────────────────────────────────────────

const SPAM_PATTERNS = [
  // Repeated characters (e.g., "aaaaaaa", "!!!!!!!")
  /(.)\1{6,}/g,
  // Repeated words (e.g., "buy buy buy buy")
  /\b(\w+)\s+\1\s+\1\s+\1/gi,
  // All caps (more than 70% of message)
  /^[A-Z\s\d!@#$%^&*()]{20,}$/,
  // URL spam (3+ URLs)
  /(https?:\/\/[^\s]+.*){3,}/gi,
  // Phone numbers
  /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  // Crypto scam patterns
  /\b(bitcoin|btc|ethereum|eth|usdt|crypto|airdrop|free coins|double your)\b/gi,
  // Follow-for-follow
  /\b(f4f|follow4follow|follow back|follow me|follow4like)\b/gi,
  // DM spam
  /\b(dm me|send me a dm|check my dms|message me)\b/gi,
]

const SPAM_KEYWORDS = new Set([
  "buy followers",
  "get followers free",
  "earn money fast",
  "work from home guaranteed",
  "click here now",
  "limited time offer",
  "act now",
  "congratulations you won",
  "you have been selected",
  "free iphone",
  "free gift card",
  "nigerian prince",
  "wire transfer",
  "bank account details",
  "social security number",
])

/**
 * Check if content is spam
 */
export function detectSpam(content: string): {
  isSpam: boolean
  reasons: string[]
  score: number
} {
  const reasons: string[] = []
  let score = 0

  const lowerContent = content.toLowerCase()

  // Check spam keywords
  for (const keyword of SPAM_KEYWORDS) {
    if (lowerContent.includes(keyword)) {
      reasons.push(`Contains spam keyword: "${keyword}"`)
      score += 30
    }
  }

  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push(`Matches spam pattern: ${pattern.source.slice(0, 50)}`)
      score += 20
    }
  }

  // Check link density
  const links = content.match(/https?:\/\/[^\s]+/g) || []
  if (links.length > 2) {
    reasons.push(`${links.length} links detected (max 2 allowed)`)
    score += 15 * (links.length - 2)
  }

  // Check character repetition ratio
  const uniqueChars = new Set(content.toLowerCase().replace(/\s/g, "")).size
  const totalChars = content.replace(/\s/g, "").length
  if (totalChars > 20 && uniqueChars / totalChars < 0.2) {
    reasons.push("Low character diversity (possible spam)")
    score += 25
  }

  return {
    isSpam: score >= 40,
    reasons,
    score: Math.min(score, 100),
  }
}

// ─── Toxicity Detection ────────────────────────────────────────────

const TOXIC_PATTERNS = [
  // Slurs and hate speech (partial list — expand as needed)
  /\b(n[i1]gg[a3]r|f[a4]g[o0]t|r[e3]t[a4]rd|c[u0]nt|b[i1]tch|wh[o0]r[e3])\b/gi,
  // Threats
  /\b(kill you|i'll kill|death threat|shoot you|bomb you)\b/gi,
  // Harassment
  /\b(kys|kill yourself|go die|end yourself|neck rope)\b/gi,
  // Self-harm encouragement
  /\b(cut yourself|slit wrists|hang yourself)\b/gi,
]

/**
 * Check for toxic content
 */
export function detectToxicity(content: string): {
  isToxic: boolean
  reasons: string[]
  score: number
  severity: "low" | "medium" | "high" | "critical"
} {
  const reasons: string[] = []
  let score = 0

  for (const pattern of TOXIC_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push(`Toxic pattern detected`)
      score += 40
    }
  }

  // Check excessive profanity (3+ curse words)
  const profanityCount = (content.match(/\b(damn|hell|ass|crap|shit|fuck|bastard|bitch)\b/gi) || []).length
  if (profanityCount >= 3) {
    reasons.push(`Excessive profanity (${profanityCount} instances)`)
    score += 20
  }

  let severity: "low" | "medium" | "high" | "critical" = "low"
  if (score >= 80) severity = "critical"
  else if (score >= 50) severity = "high"
  else if (score >= 30) severity = "medium"

  return {
    isToxic: score >= 30,
    reasons,
    score: Math.min(score, 100),
    severity,
  }
}

// ─── NSFW Detection ────────────────────────────────────────────────

const NSFW_KEYWORDS = new Set([
  "porn", "nude", "naked", "xxx", "nsfw", "onlyfans",
  "sex tape", "leaked photos", "leaked videos",
])

/**
 * Basic NSFW text detection (for images, use Cloudinary's NSFW detection)
 */
export function detectNsfwText(content: string): {
  isNsfw: boolean
  reasons: string[]
} {
  const reasons: string[] = []
  const lower = content.toLowerCase()

  for (const keyword of NSFW_KEYWORDS) {
    if (lower.includes(keyword)) {
      reasons.push(`NSFW keyword: "${keyword}"`)
    }
  }

  return {
    isNsfw: reasons.length > 0,
    reasons,
  }
}

// ─── Combined Moderation ───────────────────────────────────────────

export interface ModerationResult {
  allowed: boolean
  spam: ReturnType<typeof detectSpam>
  toxicity: ReturnType<typeof detectToxicity>
  nsfw: ReturnType<typeof detectNsfwText>
  overallScore: number
  action: "allow" | "flag" | "block"
  message?: string
}

/**
 * Run full moderation pipeline on text content
 */
export function moderateContent(
  content: string,
  options: { strict?: boolean } = {}
): ModerationResult {
  const { strict = false } = options

  const spam = detectSpam(content)
  const toxicity = detectToxicity(content)
  const nsfw = detectNsfwText(content)

  const overallScore = Math.max(spam.score, toxicity.score, nsfw.isNsfw ? 60 : 0)

  let action: "allow" | "flag" | "block" = "allow"
  let message: string | undefined

  if (overallScore >= 70 || toxicity.severity === "critical") {
    action = "block"
    message = "This content violates our community guidelines and cannot be posted."
  } else if (overallScore >= 40 || toxicity.severity === "high" || strict) {
    action = "flag"
    message = "This content has been flagged for review."
  } else if (overallScore >= 20) {
    action = "allow"
    message = undefined
  }

  return {
    allowed: action !== "block",
    spam,
    toxicity,
    nsfw,
    overallScore,
    action,
    message,
  }
}

// ─── Client-side Pre-check ─────────────────────────────────────────

/**
 * Run client-side moderation before allowing form submission
 * Returns user-friendly error message if blocked
 */
export function preModerate(content: string): string | null {
  const result = moderateContent(content)
  if (!result.allowed) return result.message || "Content not allowed"
  return null
}

// ─── Rate Limiting for Posts ───────────────────────────────────────

const postTimestamps = new Map<string, number[]>()

/**
 * Check if user is posting too fast (anti-spam)
 * Max 5 posts per minute
 */
export function checkPostRateLimit(userId: string): boolean {
  const now = Date.now()
  const windowMs = 60_000 // 1 minute
  const maxPosts = 5

  const timestamps = postTimestamps.get(userId) || []
  const recent = timestamps.filter((t) => now - t < windowMs)
  postTimestamps.set(userId, recent)

  if (recent.length >= maxPosts) return false

  recent.push(now)
  return true
}

// ─── Report System ─────────────────────────────────────────────────

export type ReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "violence"
  | "nudity"
  | "misinformation"
  | "copyright"
  | "self_harm"
  | "other"

/**
 * Submit a content report
 */
export async function submitReport(
  contentId: string,
  contentType: "loop" | "comment" | "message" | "profile",
  reason: ReportReason,
  details: string,
  authHeaders: Record<string, string>
): Promise<boolean> {
  try {
    const res = await fetch("/api/moderation/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ contentId, contentType, reason, details }),
    })
    return res.ok
  } catch {
    return false
  }
}
