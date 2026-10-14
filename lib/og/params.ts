/**
 * Query-string parsing for the OG route.
 *
 * Pure and dependency-free so it can be unit tested. Every legacy parameter
 * the platform already sends is preserved; new layout-only parameters are
 * additive and optional, so an old URL never breaks.
 */

import { parseBool, parseColors, parseStat, truncate } from "./text"

export interface OgPersonDraft {
  name?: string
  username?: string
  avatar?: string
}

export interface OgDraft {
  type: OgType
  title: string
  description: string
  body?: string
  name?: string
  username?: string
  avatar?: string
  date?: string
  category?: string
  url?: string
  stat?: number
  statLabel?: string
  verified: boolean
  premium: boolean
  badgeColors?: string[]
  media?: string
  people: OgPersonDraft[]
  sides: OgPersonDraft[]
  progress?: { value: number; max: number; label: string }
  dateBlock?: { day: string; month: string }
  extraStats: { value: string; label: string }[]
}

/** Canonical template keys. */
export const OG_TYPES = [
  "home",
  "post",
  "profile",
  "community",
  "space",
  "duel",
  "coloop",
  "reel",
  "project",
  "event",
  "challenge",
  "fallback",
] as const

export type OgType = (typeof OG_TYPES)[number]

/**
 * Map every type string the app has ever emitted onto a template. Legacy
 * `loop` / `developer` / `moment` / `quest` values keep working.
 */
export function normalizeType(raw: string | null | undefined): OgType {
  const key = String(raw || "home").trim().toLowerCase()
  const aliases: Record<string, OgType> = {
    home: "home",
    website: "home",
    landing: "home",
    login: "home",
    signup: "home",
    loop: "post",
    post: "post",
    code: "post",
    developer: "post",
    timeline: "post",
    profile: "profile",
    user: "profile",
    community: "community",
    circle: "community",
    space: "space",
    spaces: "space",
    duel: "duel",
    debate: "duel",
    coloop: "coloop",
    "co-loop": "coloop",
    collaboration: "coloop",
    reel: "reel",
    reels: "reel",
    moment: "reel",
    video: "reel",
    project: "project",
    repo: "project",
    event: "event",
    challenge: "challenge",
    quest: "challenge",
  }
  return aliases[key] || "fallback"
}

/** "Name|avatarUrl" → person. Extra fields are ignored, blanks dropped. */
function parsePerson(raw: string | null | undefined): OgPersonDraft | null {
  const value = String(raw || "").trim()
  if (!value) return null
  const [name, avatar] = value.split("|").map((part) => part.trim())
  if (!name && !avatar) return null
  const handle = name?.startsWith("@") ? name.slice(1) : undefined
  return { name: name || undefined, username: handle, avatar: avatar || undefined }
}

function parsePeople(sp: URLSearchParams): OgPersonDraft[] {
  const collected: OgPersonDraft[] = []
  const list = sp.get("people")
  if (list) {
    for (const chunk of list.split(",")) {
      const person = parsePerson(chunk)
      if (person) collected.push(person)
    }
  }
  for (let i = 1; i <= 4; i++) {
    const person = parsePerson(sp.get(`p${i}`))
    if (person) collected.push(person)
  }
  // De-duplicate by name so a caller that sends both forms does not double up.
  const seen = new Set<string>()
  return collected.filter((person) => {
    const key = `${person.name || ""}|${person.username || ""}|${person.avatar || ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** "12|stars,3|forks" → stat readouts. */
function parseExtraStats(sp: URLSearchParams): { value: string; label: string }[] {
  const raw = sp.get("stats") || sp.get("extra_stats")
  if (!raw) return []
  return raw
    .split(",")
    .map((chunk) => {
      const [value, label] = chunk.split("|").map((part) => part.trim())
      if (!value || !label) return null
      return { value: truncate(value, 8), label: truncate(label, 14) }
    })
    .filter(Boolean)
    .slice(0, 4) as { value: string; label: string }[]
}

/** "57|100|Followers" → progress bar. */
function parseProgress(sp: URLSearchParams): OgDraft["progress"] {
  const packed = sp.get("progress")
  let value = parseStat(sp.get("progress_value"))
  let max = parseStat(sp.get("progress_max"))
  let label = truncate(sp.get("progress_label") || "", 40)
  if (packed) {
    const [v, m, l] = packed.split("|")
    value = parseStat(v)
    max = parseStat(m)
    label = truncate(l || label, 40)
  }
  if (!max) return undefined
  return { value: Math.max(0, value), max, label: label || "Progress" }
}

function parseDateBlock(sp: URLSearchParams): OgDraft["dateBlock"] {
  const day = truncate(sp.get("date_day") || "", 3)
  const month = truncate(sp.get("date_month") || "", 3)
  if (!day && !month) return undefined
  return { day: day || "—", month: month || "" }
}

export const DEFAULT_TITLE = "Loop — Build Together, Not Just Post Into The Void"

export const DEFAULT_DESCRIPTION =
  "The collaborative social network where you co-write posts live with friends, settle debates in public Duels, build communities in Circles, and earn rewards for being active."

/**
 * Build the render-time draft from the request's query string. Titles and
 * descriptions are trimmed here (not in templates) so every layout gets an
 * already-safe string and long content can never break a composition.
 */
export function parseOgParams(sp: URLSearchParams): OgDraft {
  const type = normalizeType(sp.get("type"))
  const isPrivate = parseBool(sp.get("is_private"))
  const category = truncate(sp.get("category") || (isPrivate ? "Private" : ""), 26)

  return {
    type,
    title: truncate(sp.get("title") || DEFAULT_TITLE, 90),
    description: truncate(sp.get("description") || DEFAULT_DESCRIPTION, 190),
    body: sp.get("body") ? truncate(sp.get("body"), 560) : undefined,
    name: sp.get("name") ? truncate(sp.get("name"), 40) : undefined,
    username: sp.get("username") ? truncate(sp.get("username"), 30) : undefined,
    avatar: sp.get("avatar")?.trim() || undefined,
    media: sp.get("media")?.trim() || undefined,
    date: sp.get("date") ? truncate(sp.get("date"), 32) : undefined,
    category: category || undefined,
    url: sp.get("url") ? truncate(sp.get("url"), 48) : undefined,
    stat: parseStat(sp.get("stat")),
    statLabel: sp.get("stat_label") ? truncate(sp.get("stat_label"), 18) : undefined,
    verified: parseBool(sp.get("verified")),
    premium: parseBool(sp.get("premium")),
    badgeColors: parseColors(sp.get("badge_color"), sp.get("badge_color2")),
    people: parsePeople(sp),
    sides: [parsePerson(sp.get("side1")), parsePerson(sp.get("side2"))].filter(Boolean) as OgPersonDraft[],
    progress: parseProgress(sp),
    dateBlock: parseDateBlock(sp),
    extraStats: parseExtraStats(sp),
  }
}
