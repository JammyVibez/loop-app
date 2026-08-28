/**
 * Lightweight A/B testing framework.
 * Uses deterministic hashing so the same user always sees the same variant.
 * No external service needed — pure client-side + localStorage.
 */

import crypto from "crypto"

export interface Experiment {
  id: string
  name: string
  variants: Variant[]
  /** Percentage of users to include (0-100) */
  traffic: number
  /** Start date (ISO) */
  startAt?: string
  /** End date (ISO) */
  endAt?: string
}

export interface Variant {
  id: string
  name: string
  weight: number // relative weight among variants
  config?: Record<string, any>
}

// ─── Experiment Registry ───────────────────────────────────────────

const EXPERIMENTS: Experiment[] = [
  {
    id: "feed-algorithm-v2",
    name: "Feed Algorithm V2 — Collaborative Filtering",
    variants: [
      { id: "control", name: "Current Algorithm", weight: 50 },
      { id: "collaborative", name: "Collaborative Filtering", weight: 50 },
    ],
    traffic: 50,
  },
  {
    id: "onboarding-flow",
    name: "Onboarding Flow Test",
    variants: [
      { id: "current", name: "Current 5-step", weight: 50 },
      { id: "simplified", name: "Simplified 3-step", weight: 50 },
    ],
    traffic: 30,
  },
  {
    id: "share-sheet-style",
    name: "Share Sheet UI Test",
    variants: [
      { id: "bottom-sheet", name: "Bottom Sheet", weight: 50 },
      { id: "modal", name: "Modal Dialog", weight: 50 },
    ],
    traffic: 40,
  },
  {
    id: "loop-card-layout",
    name: "Loop Card Layout Test",
    variants: [
      { id: "current", name: "Current Layout", weight: 50 },
      { id: "compact", name: "Compact Layout", weight: 50 },
    ],
    traffic: 25,
  },
]

// ─── Core Functions ────────────────────────────────────────────────

/**
 * Get a deterministic hash for user + experiment
 */
function getHash(userId: string, experimentId: string): number {
  const input = `${userId}:${experimentId}`
  const hash = crypto.createHash("md5").update(input).digest("hex")
  return parseInt(hash.slice(0, 8), 16) % 100
}

/**
 * Check if an experiment is active
 */
function isExperimentActive(experiment: Experiment): boolean {
  const now = new Date()
  if (experiment.startAt && new Date(experiment.startAt) > now) return false
  if (experiment.endAt && new Date(experiment.endAt) < now) return false
  return true
}

/**
 * Get the variant for a user in an experiment
 * Returns null if user is not in the experiment's traffic
 */
export function getVariant(
  userId: string,
  experimentId: string
): { variant: Variant; config?: Record<string, any> } | null {
  // Check cache first
  const cacheKey = `ab:${experimentId}:${userId}`
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) return JSON.parse(cached)
  } catch {}

  const experiment = EXPERIMENTS.find((e) => e.id === experimentId)
  if (!experiment || !isExperimentActive(experiment)) return null

  // Check traffic allocation
  const trafficHash = getHash(userId, `${experimentId}:traffic`)
  if (trafficHash >= experiment.traffic) return null

  // Determine variant
  const variantHash = getHash(userId, `${experimentId}:variant`)
  const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0)
  let cumulative = 0

  for (const variant of experiment.variants) {
    cumulative += (variant.weight / totalWeight) * 100
    if (variantHash < cumulative) {
      const result = { variant, config: variant.config }
      // Cache for 24 hours
      try {
        localStorage.setItem(cacheKey, JSON.stringify(result))
      } catch {}
      return result
    }
  }

  // Fallback to first variant
  const fallback = { variant: experiment.variants[0], config: experiment.variants[0].config }
  try {
    localStorage.setItem(cacheKey, JSON.stringify(fallback))
  } catch {}
  return fallback
}

/**
 * Check if user is in a specific variant
 */
export function isInVariant(
  userId: string,
  experimentId: string,
  variantId: string
): boolean {
  const result = getVariant(userId, experimentId)
  return result?.variant.id === variantId
}

/**
 * Get config value for a variant
 */
export function getExperimentConfig<T = any>(
  userId: string,
  experimentId: string,
  key: string,
  defaultValue: T
): T {
  const result = getVariant(userId, experimentId)
  if (!result?.config) return defaultValue
  return (result.config[key] as T) ?? defaultValue
}

/**
 * Track an experiment conversion event
 */
export function trackConversion(
  userId: string,
  experimentId: string,
  eventName: string,
  value?: number
): void {
  const result = getVariant(userId, experimentId)
  if (!result) return

  // Send to analytics
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "experiment_conversion", {
      experiment_id: experimentId,
      variant_id: result.variant.id,
      event_name: eventName,
      value: value,
    })
  }

  // Store locally for server-side sync
  try {
    const events = JSON.parse(localStorage.getItem("ab_events") || "[]")
    events.push({
      userId,
      experimentId,
      variantId: result.variant.id,
      eventName,
      value,
      timestamp: Date.now(),
    })
    // Keep last 100 events
    localStorage.setItem("ab_events", JSON.stringify(events.slice(-100)))
  } catch {}
}

/**
 * Get all active experiments for a user (for logging/debugging)
 */
export function getActiveExperiments(userId: string): Array<{
  experiment: Experiment
  variant: Variant | null
}> {
  return EXPERIMENTS.filter(isExperimentActive).map((experiment) => ({
    experiment,
    variant: getVariant(userId, experiment.id)?.variant || null,
  }))
}

// ─── Server-side helpers ───────────────────────────────────────────

/**
 * Get variant from server (for API routes that need to know the variant)
 */
export function getServerVariant(
  userId: string,
  experimentId: string
): string | null {
  const experiment = EXPERIMENTS.find((e) => e.id === experimentId)
  if (!experiment || !isExperimentActive(experiment)) return null

  const trafficHash = getHash(userId, `${experimentId}:traffic`)
  if (trafficHash >= experiment.traffic) return null

  const variantHash = getHash(userId, `${experimentId}:variant`)
  const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0)
  let cumulative = 0

  for (const variant of experiment.variants) {
    cumulative += (variant.weight / totalWeight) * 100
    if (variantHash < cumulative) return variant.id
  }

  return experiment.variants[0]?.id || null
}
