/** Shared ranking helpers for For You / Trending feeds */

export function rawEngagementScore(loop: any) {
  const stats = Array.isArray(loop.loop_stats) ? loop.loop_stats[0] : loop.loop_stats || loop.stats || {}
  return (
    Number(stats?.likes_count || stats?.likes || 0) * 3 +
    Number(stats?.comments_count || stats?.comments || 0) * 4 +
    Number(stats?.branches_count || stats?.branches || 0) * 5 +
    Number(stats?.shares_count || stats?.shares || 0) * 4 +
    Number(stats?.views_count || stats?.views || 0) * 0.15
  )
}

/** Time-decayed engagement — newer posts stay competitive */
export function smartEngagementScore(loop: any, now = Date.now()) {
  const base = rawEngagementScore(loop)
  const created = new Date(loop.created_at || now).getTime()
  const ageHours = Math.max(0, (now - created) / (1000 * 60 * 60))
  // Half-life ~36h
  const decay = Math.pow(0.5, ageHours / 36)
  const recencyBoost = ageHours < 6 ? 1.35 : ageHours < 24 ? 1.15 : 1
  return base * decay * recencyBoost + (ageHours < 2 ? 8 : 0)
}

export function hashtagAffinityBonus(loop: any, affinity: Map<string, number>) {
  if (!affinity.size) return 0
  const tags = Array.isArray(loop.hashtags) ? loop.hashtags : []
  let bonus = 0
  for (const raw of tags) {
    const tag = String(raw).toLowerCase().replace(/^#/, "")
    bonus += (affinity.get(tag) || 0) * 4
  }
  return bonus
}

export function followingBoost(loop: any, followingIds: Set<string>) {
  if (!loop?.author_id) return 0
  return followingIds.has(loop.author_id) ? 18 : 0
}

export function normalizeHashtag(tag: string) {
  return String(tag || "")
    .replace(/^#/, "")
    .toLowerCase()
    .trim()
}
