/** Loop Quests v2 — shared quest domain helpers. */

export type QuestStatus = "draft" | "active" | "paused" | "archived"

export const QUEST_LEVELS: ReadonlyArray<{ level: number; name: string; minXp: number }> = [
  { level: 1, name: "Explorer", minXp: 0 },
  { level: 2, name: "Participant", minXp: 150 },
  { level: 3, name: "Contributor", minXp: 450 },
  { level: 4, name: "Trailblazer", minXp: 1000 },
  { level: 5, name: "Loop Veteran", minXp: 2000 },
]

export function questLevelFromXp(xp: number): { level: number; name: string; minXp: number; nextXp: number | null } {
  let current = QUEST_LEVELS[0]
  for (const tier of QUEST_LEVELS) {
    if (xp >= tier.minXp) current = tier
  }
  const next = QUEST_LEVELS.find((t) => t.minXp > current.minXp)
  return { level: current.level, name: current.name, minXp: current.minXp, nextXp: next ? next.minXp : null }
}

/* ------------------------------------------------------------------ */
/* Config types                                                        */
/* ------------------------------------------------------------------ */

export interface MissionStepConfig {
  title: string
  description?: string
  /** How the step verifies: trackable native action, or a "gated" step that
   * must be explicitly completed through a linked activity (survey/game/community). */
  verify: "native" | "manual" | "linked"
  native_action?: string
  /** Linked activity type for gated steps. */
  link_kind?: "survey" | "game" | "video" | "community"
  required?: boolean
  reward_coins?: number
}

export interface SurveyQuestionConfig {
  type: "single" | "multiple" | "rating" | "text" | "boolean"
  question: string
  options?: string[]
  required?: boolean
}

export interface GameConfigV2 {
  kind: "memory" | "trivia" | "reaction"
  min_score?: number
  max_attempts?: number
}

/** Derived per-user quest state used by board + detail UI. */
export type QuestUserState =
  | "locked"
  | "available"
  | "in_progress"
  | "completed"
  | "claimable"
  | "claimed"
  | "expired"

export function deriveQuestState(opts: {
  status: string
  isActive: boolean
  startsAt?: string | null
  endsAt?: string | null
  progress?: number
  required?: number
  completedAt?: string | null
  claimedAt?: string | null
  autoClaim?: boolean
}): QuestUserState {
  const now = new Date()
  if (opts.endsAt && new Date(opts.endsAt) < now && !opts.claimedAt) return "expired"
  if (opts.startsAt && new Date(opts.startsAt) > now) return "locked"
  if (!opts.isActive && opts.status === "paused") return "available"
  if (opts.claimedAt) return "claimed"
  if (opts.completedAt) return opts.autoClaim ? "claimed" : "claimable"
  if ((opts.progress ?? 0) > 0) return "in_progress"
  if (opts.status === "draft" || opts.status === "archived") return "locked"
  return "available"
}

export const STATE_META: Record<QuestUserState, { label: string; cta?: string; tone: string }> = {
  locked: { label: "Locked", tone: "text-muted-foreground" },
  available: { label: "Available", cta: "Start quest", tone: "text-primary" },
  in_progress: { label: "In progress", cta: "Continue", tone: "text-sky-500" },
  completed: { label: "Completed", tone: "text-emerald-500" },
  claimable: { label: "Reward ready", cta: "Claim reward", tone: "text-amber-500" },
  claimed: { label: "Claimed", cta: "Claimed", tone: "text-emerald-600" },
  expired: { label: "Expired", cta: "Expired", tone: "text-muted-foreground" },
}

/* ------------------------------------------------------------------ */
/* Streaks                                                             */
/* ------------------------------------------------------------------ */

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}
function yesterdayKey(now = new Date()): string {
  return new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
}

/** Advance the streak if this is a new day; reset if a day was missed. */
export function nextStreak(row: { current_streak: number; best_streak: number; last_day: string | null }): {
  current_streak: number
  best_streak: number
  last_day: string
  increased: boolean
} {
  const today = todayKey()
  if (row.last_day === today) {
    return { current_streak: row.current_streak, best_streak: row.best_streak, last_day: today, increased: false }
  }
  const continues = row.last_day === yesterdayKey()
  const current = continues ? row.current_streak + 1 : 1
  return {
    current_streak: current,
    best_streak: Math.max(row.best_streak || 0, current),
    last_day: today,
    increased: true,
  }
}

/* ------------------------------------------------------------------ */
/* Format helpers                                                      */
/* ------------------------------------------------------------------ */

export function formatTimeRemaining(endsAt?: string | null): string | null {
  if (!endsAt) return null
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60000))}m left`
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

export function estimateLabel(estMinutes?: number | null): string | null {
  if (!estMinutes || estMinutes <= 0) return null
  if (estMinutes < 60) return `~${estMinutes} min`
  return `~${Math.round(estMinutes / 60)}h`
}

/** Section keys used by the board page. Sections with no quests are hidden. */
export type BoardSection =
  | "featured"
  | "daily"
  | "weekly"
  | "limited"
  | "games"
  | "surveys"
  | "watch"
  | "community"
  | "missions"
  | "completed"

export function sectionForQuest(q: {
  quest_kind?: string
  cadence?: string
  category?: string | null
  quest_type?: string
  featured?: boolean
  ends_at?: string | null
}): BoardSection {
  if (q.quest_kind === "mission") return "missions"
  if (q.cadence === "daily") return "daily"
  if (q.cadence === "weekly") return "weekly"
  if (q.quest_type === "minigame" || (q.category === "game")) return "games"
  if (q.quest_type === "survey" || q.category === "survey") return "surveys"
  if (q.quest_type === "ad" || q.category === "watch") return "watch"
  if (q.category === "community" || q.category === "creator" || q.category === "discovery") return "community"
  if (q.ends_at || q.cadence === "seasonal") return "limited"
  return "limited"
}
