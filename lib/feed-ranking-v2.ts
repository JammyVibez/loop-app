/**
 * Enhanced feed ranking with collaborative filtering.
 * Layer 1: Content-based scoring (what you liked before)
 * Layer 2: Collaborative filtering (what similar users liked)
 * Layer 3: Social graph boost (friends' content)
 * Layer 4: Freshness decay (newer posts rank higher)
 * Layer 5: Diversity injection (avoid echo chamber)
 */

interface LoopCandidate {
  id: string
  author_id: string
  hashtags?: string[]
  media_type?: string
  created_at: string
  stats?: {
    likes_count?: number
    comments_count?: number
    branches_count?: number
    shares_count?: number
    views_count?: number
  }
  author?: {
    id?: string
    is_organization?: boolean
  }
}

interface UserProfile {
  id: string
  likedHashtags: Map<string, number>     // hashtag → interaction count
  likedAuthors: Set<string>              // author IDs they interacted with
  likedMediaTypes: Map<string, number>   // "image" → count, "video" → count
  followingIds: Set<string>
  recentLoopIds: Set<string>             // avoid showing same content
}

// ─── Content-Based Scoring ─────────────────────────────────────────

function contentScore(loop: LoopCandidate, profile: UserProfile): number {
  let score = 0

  // Hashtag affinity
  const tags = loop.hashtags || []
  for (const tag of tags) {
    const norm = tag.toLowerCase().replace(/^#/, "")
    score += (profile.likedHashtags.get(norm) || 0) * 3
  }

  // Author affinity (have they liked this author before?)
  if (loop.author_id && profile.likedAuthors.has(loop.author_id)) {
    score += 15
  }

  // Media type preference
  if (loop.media_type && profile.likedMediaTypes.has(loop.media_type)) {
    score += (profile.likedMediaTypes.get(loop.media_type) || 0) * 2
  }

  return score
}

// ─── Collaborative Filtering Score ─────────────────────────────────

function collaborativeScore(
  loop: LoopCandidate,
  similarUserInteractions: Map<string, number>
): number {
  // How many similar users interacted with this loop
  const interactions = similarUserInteractions.get(loop.id) || 0
  return interactions * 8
}

// ─── Social Graph Boost ────────────────────────────────────────────

function socialScore(loop: LoopCandidate, profile: UserProfile): number {
  if (!loop.author_id) return 0

  // Following bonus
  if (profile.followingIds.has(loop.author_id)) {
    return 20
  }

  // Organization boost
  if (loop.author?.is_organization) {
    return 10
  }

  return 0
}

// ─── Freshness Decay ───────────────────────────────────────────────

function freshnessScore(createdAt: string, now: number = Date.now()): number {
  const created = new Date(createdAt).getTime()
  const ageHours = Math.max(0, (now - created) / (1000 * 60 * 60))

  // Half-life of 24 hours
  const decay = Math.pow(0.5, ageHours / 24)

  // Recency bonus for very new content (< 2 hours)
  const recencyBonus = ageHours < 2 ? 1.5 : ageHours < 6 ? 1.2 : 1

  return decay * recencyBonus * 10
}

// ─── Engagement Score ──────────────────────────────────────────────

function engagementScore(loop: LoopCandidate): number {
  const stats = loop.stats || {}
  const likes = Number(stats.likes_count || 0)
  const comments = Number(stats.comments_count || 0)
  const branches = Number(stats.branches_count || 0)
  const shares = Number(stats.shares_count || 0)
  const views = Number(stats.views_count || 0)

  // Weighted engagement
  return (
    likes * 2 +
    comments * 3 +
    branches * 5 +
    shares * 4 +
    views * 0.1
  )
}

// ─── Diversity Injection ───────────────────────────────────────────

/**
 * Ensure feed isn't dominated by one author or topic
 */
function diversifyFeed<T extends { author_id?: string; hashtags?: string[] }>(
  sorted: T[],
  maxConsecutive: number = 2
): T[] {
  const result: T[] = []
  const authorCounts = new Map<string, number>()
  let lastAuthor = ""
  let consecutiveCount = 0

  for (const item of sorted) {
    const authorId = item.author_id || ""

    // Check if we'd exceed consecutive limit
    if (authorId === lastAuthor) {
      consecutiveCount++
      if (consecutiveCount > maxConsecutive) continue // Skip this one
    } else {
      consecutiveCount = 1
      lastAuthor = authorId
    }

    result.push(item)
    authorCounts.set(authorId, (authorCounts.get(authorId) || 0) + 1)
  }

  return result
}

// ─── Main Ranking Function ─────────────────────────────────────────

export interface RankingContext {
  profile: UserProfile
  similarUserInteractions?: Map<string, number>
  /** Force a specific experiment variant */
  variant?: "control" | "collaborative"
}

/**
 * Rank feed candidates using the multi-layer scoring system
 */
export function rankFeed(
  candidates: LoopCandidate[],
  context: RankingContext,
  now: number = Date.now()
): LoopCandidate[] {
  const { profile, similarUserInteractions = new Map(), variant = "collaborative" } = context

  // Filter out already-seen content
  const unseen = candidates.filter((c) => !profile.recentLoopIds.has(c.id))

  // Score each candidate
  const scored = unseen.map((loop) => {
    let totalScore = 0

    // Layer 1: Content-based (always applied)
    totalScore += contentScore(loop, profile)

    // Layer 2: Collaborative filtering (only in collaborative variant)
    if (variant === "collaborative") {
      totalScore += collaborativeScore(loop, similarUserInteractions)
    }

    // Layer 3: Social graph (always applied)
    totalScore += socialScore(loop, profile)

    // Layer 4: Freshness (always applied)
    totalScore += freshnessScore(loop.created_at, now)

    // Layer 5: Engagement (always applied, but lower weight)
    totalScore += engagementScore(loop) * 0.5

    return { loop, score: totalScore }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Apply diversity injection
  const sorted = scored.map((s) => s.loop)
  return diversifyFeed(sorted)
}

/**
 * Build user profile from interaction history
 */
export function buildUserProfile(interactions: Array<{
  loop_id: string
  interaction_type: string
  created_at: string
  loop?: {
    author_id?: string
    hashtags?: string[]
    media_type?: string
  }
}>, followingIds: string[]): UserProfile {
  const profile: UserProfile = {
    id: "",
    likedHashtags: new Map(),
    likedAuthors: new Set(),
    likedMediaTypes: new Map(),
    followingIds: new Set(followingIds),
    recentLoopIds: new Set(),
  }

  for (const interaction of interactions) {
    const loop = interaction.loop
    if (!loop) continue

    profile.recentLoopIds.add(interaction.loop_id)

    // Boost hashtags from liked content
    if (interaction.interaction_type === "like" || interaction.interaction_type === "save") {
      for (const tag of loop.hashtags || []) {
        const norm = tag.toLowerCase().replace(/^#/, "")
        profile.likedHashtags.set(norm, (profile.likedHashtags.get(norm) || 0) + 1)
      }

      // Track author affinity
      if (loop.author_id) {
        profile.likedAuthors.add(loop.author_id)
      }

      // Track media type preference
      if (loop.media_type) {
        profile.likedMediaTypes.set(
          loop.media_type,
          (profile.likedMediaTypes.get(loop.media_type) || 0) + 1
        )
      }
    }
  }

  return profile
}
