/**
 * For You feed ranking.
 *
 * This module is intentionally dependency-free and owns every tunable number
 * for the blended feed. The API ranks each source, then `blendForYouFeed`
 * merges them with stable fair-share scheduling so the mix stays close to the
 * configured weights without making the feed look mechanical.
 */

export type ForYouSource = "following" | "trending" | "discovery"

export type ForYouMix = Record<ForYouSource, number>

export type ForYouConfig = {
  /** Target share of each source. Values are normalized before blending. */
  mix: ForYouMix
  /** Recency half-life for engagement-ranked posts. */
  recencyHalfLifeHours: number
  /** Stronger half-life for the fresh/discovery source. */
  discoveryHalfLifeHours: number
  /** Hard cap on consecutive posts from one author. */
  maxConsecutivePerAuthor: number
  /** Only considers public posts created within this window. */
  candidateWindowDays: number
  /** Candidate pool size for the first page. */
  candidateLimitBase: number
  /** Extra candidate rows fetched per page of offset. */
  candidateLimitPerPage: number
  /** Upper bound so deep pagination cannot scan the whole table. */
  candidateLimitMax: number
  /** Ranking boosts, kept here so the feed can be tuned in one place. */
  followingScoreBonus: number
  ownPostScoreBonus: number
  organizationScoreBonus: number
  discoveryFreshnessWeight: number
  discoveryEngagementWeight: number
}

export const FOR_YOU_CONFIG: ForYouConfig = {
  mix: { following: 0.4, trending: 0.35, discovery: 0.25 },
  recencyHalfLifeHours: 36,
  discoveryHalfLifeHours: 18,
  maxConsecutivePerAuthor: 2,
  candidateWindowDays: 21,
  candidateLimitBase: 180,
  candidateLimitPerPage: 4,
  candidateLimitMax: 500,
  followingScoreBonus: 24,
  ownPostScoreBonus: 6,
  organizationScoreBonus: 25,
  discoveryFreshnessWeight: 100,
  discoveryEngagementWeight: 4,
}

export type ForYouRankable = {
  id: string
  author_id?: string | null
  created_at?: string | null
}

function normalizeWeights(weights: ForYouMix): ForYouMix {
  const following = Math.max(0, Number(weights.following) || 0)
  const trending = Math.max(0, Number(weights.trending) || 0)
  const discovery = Math.max(0, Number(weights.discovery) || 0)
  const total = following + trending + discovery
  if (total <= 0) return { following: 0.4, trending: 0.35, discovery: 0.25 }
  return {
    following: following / total,
    trending: trending / total,
    discovery: discovery / total,
  }
}

export function candidateLimitForOffset(offset: number, limit: number, config = FOR_YOU_CONFIG): number {
  const requested = Math.max(1, offset) + Math.max(1, limit)
  return Math.min(
    config.candidateLimitMax,
    Math.max(config.candidateLimitBase, requested * config.candidateLimitPerPage),
  )
}

export function ageHours(createdAt: string | null | undefined, now = Date.now()): number {
  const created = createdAt ? new Date(createdAt).getTime() : Number.NaN
  if (!Number.isFinite(created)) return 0
  return Math.max(0, (now - created) / 3_600_000)
}

/** Exponential decay where the score halves every `halfLifeHours`. */
export function recencyDecay(
  createdAt: string | null | undefined,
  halfLifeHours: number,
  now = Date.now(),
): number {
  const safeHalfLife = Math.max(0.5, halfLifeHours)
  return Math.pow(0.5, ageHours(createdAt, now) / safeHalfLife)
}

/**
 * Merge already-scored source lists into one feed.
 *
 * - Deduplicates by post id across sources and pages.
 * - Never removes a post just because the viewer already saw it.
 * - Never emits more than `maxConsecutivePerAuthor` posts by one author.
 * - Uses weighted fair scheduling, so a page of 20 with 40/35/25 lands close
 *   to 8 following, 7 trending and 5 discovery.
 */
export function blendForYouFeed<T extends ForYouRankable>({
  sources,
  limit,
  offset = 0,
  config = FOR_YOU_CONFIG,
  maxConsecutivePerAuthor = config.maxConsecutivePerAuthor,
}: {
  sources: Record<ForYouSource, T[]>
  limit: number
  offset?: number
  config?: ForYouConfig
  maxConsecutivePerAuthor?: number
}): { items: T[]; hasMore: boolean } {
  const safeLimit = Math.max(1, Math.floor(limit))
  const safeOffset = Math.max(0, Math.floor(offset))
  const weights = normalizeWeights(config.mix)
  const used = new Set<string>()
  const picked: ForYouMix = { following: 0, trending: 0, discovery: 0 }
  const items: T[] = []
  const order: ForYouSource[] = ["following", "trending", "discovery"]
  const target = safeOffset + safeLimit + 1

  const authorKey = (item: T) => item.author_id || item.id

  const nextCandidate = (source: ForYouSource): T | null => {
    const list = sources[source] || []
    for (const item of list) {
      if (!item?.id || used.has(item.id)) continue
      const author = authorKey(item)
      const previous = items[items.length - 1]
      const beforePrevious = items[items.length - 2]
      if (
        maxConsecutivePerAuthor > 0 &&
        previous &&
        beforePrevious &&
        authorKey(previous) === author &&
        authorKey(beforePrevious) === author
      ) {
        continue
      }
      return item
    }
    return null
  }

  while (items.length < target) {
    const available: Array<{ source: ForYouSource; candidate: T }> = []
    for (const source of order) {
      if (weights[source] <= 0) continue
      const candidate = nextCandidate(source)
      if (candidate) available.push({ source, candidate })
    }
    if (!available.length) break

    // Re-normalize across sources that still have candidates so an exhausted
    // source never leaves the remaining feed artificially even-split.
    const availableWeight = available.reduce((sum, entry) => sum + weights[entry.source], 0)
    let bestSource: ForYouSource | null = null
    let bestCandidate: T | null = null
    let bestDeficit = -Infinity

    // Deficit = how far this source is behind its weighted target at the next
    // position. The source that is most behind wins the slot.
    for (const entry of available) {
      const share = availableWeight > 0 ? weights[entry.source] / availableWeight : 0
      const deficit = share * (items.length + 1) - picked[entry.source]
      if (deficit > bestDeficit) {
        bestDeficit = deficit
        bestSource = entry.source
        bestCandidate = entry.candidate
      }
    }

    if (!bestSource || !bestCandidate) break
    used.add(bestCandidate.id)
    picked[bestSource] += 1
    items.push(bestCandidate)
  }

  return {
    items: items.slice(safeOffset, safeOffset + safeLimit),
    hasMore: items.length > safeOffset + safeLimit,
  }
}
