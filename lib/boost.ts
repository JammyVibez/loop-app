export interface BoostInfo {
  tier: 0 | 1 | 2 | 3
  coins: number
  isBoosted: boolean
  decayHours: number
  expiresAt: string | null
  timeRemainingMs: number
}

/**
 * Calculates boost tier and checks decay window.
 * Tier 1 (100-499 coins): 24h decay window
 * Tier 2 (500-1999 coins): 48h decay window
 * Tier 3 (2000+ coins): 72h decay window (Guaranteed Trending Boost Shelf)
 */
export function calculateBoostInfo(loop: any, now = Date.now()): BoostInfo {
  const coins = Number(loop?.boost_coins_current || loop?.boost_coins || 0)
  const boostedAtStr = loop?.boosted_at || loop?.updated_at || loop?.created_at
  const boostedAt = boostedAtStr ? new Date(boostedAtStr).getTime() : now

  let tier: 0 | 1 | 2 | 3 = 0
  let decayHours = 24

  if (coins >= 2000) {
    tier = 3
    decayHours = 72
  } else if (coins >= 500) {
    tier = 2
    decayHours = 48
  } else if (coins >= 100) {
    tier = 1
    decayHours = 24
  }

  if (tier === 0) {
    return { tier: 0, coins, isBoosted: false, decayHours: 0, expiresAt: null, timeRemainingMs: 0 }
  }

  const elapsedMs = Math.max(0, now - boostedAt)
  const maxDurationMs = decayHours * 3600 * 1000
  const remainingMs = maxDurationMs - elapsedMs

  if (remainingMs <= 0) {
    return { tier: 0, coins, isBoosted: false, decayHours, expiresAt: null, timeRemainingMs: 0 }
  }

  return {
    tier,
    coins,
    isBoosted: true,
    decayHours,
    expiresAt: new Date(boostedAt + maxDurationMs).toISOString(),
    timeRemainingMs: remainingMs,
  }
}

/** Check relevance of a boosted post to a specific user */
export function isBoostRelevantToUser(
  loop: any,
  boostInfo: BoostInfo,
  userId?: string | null,
  followingIds?: Set<string>,
  affinity?: Map<string, number>
): boolean {
  if (!boostInfo.isBoosted || boostInfo.tier === 0) return false

  // Tier 3 (2000+ coins): global high relevance shelf & algorithm, relevant to all active users
  if (boostInfo.tier === 3) return true

  // Tier 1 & Tier 2 require target relevance
  const authorId = loop.author_id
  const isFollower = Boolean(userId && authorId && followingIds?.has(authorId))
  const isOwnPost = Boolean(userId && authorId && authorId === userId)

  let hasTopicMatch = false
  if (affinity && affinity.size && Array.isArray(loop.hashtags)) {
    for (const raw of loop.hashtags) {
      const tag = String(raw).toLowerCase().replace(/^#/, "")
      if (tag && (affinity.get(tag) || 0) > 0) {
        hasTopicMatch = true
        break
      }
    }
  }

  if (boostInfo.tier === 1) {
    // Relevant if user follows poster or matching topic/hashtag interest or own post
    return isFollower || isOwnPost || hasTopicMatch
  }

  if (boostInfo.tier === 2) {
    // Shown to users interested in post topic or active engaged users
    return isFollower || isOwnPost || hasTopicMatch || Boolean(userId)
  }

  return false
}

/** Cap boosted posts frequency: max 1 boosted post per 10-15 organic posts */
export function capBoostedPostsInFeed<T extends { id: string }>(
  loops: T[],
  getBoostInfo: (loop: T) => BoostInfo,
  maxPerOrganicWindow = 10
): T[] {
  const result: T[] = []
  let countSinceLastBoost = 999 // allow initial boosted post if high quality

  for (const loop of loops) {
    const boost = getBoostInfo(loop)
    if (boost.isBoosted) {
      if (countSinceLastBoost >= maxPerOrganicWindow) {
        result.push(loop)
        countSinceLastBoost = 0
      } else {
        // Skip or delay overcrowded boosted post so promotion does not dominate
        continue
      }
    } else {
      result.push(loop)
      countSinceLastBoost++
    }
  }

  return result
}
