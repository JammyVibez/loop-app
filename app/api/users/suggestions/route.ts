import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { getBlockedProfileIds, isGatedVisibility } from "@/lib/privacy"
import { normalizeDiscoveryPreferences } from "@/lib/discovery-preferences"

const CANDIDATE_LIMIT = 80
const MAX_SUGGESTIONS = 20

type CandidateProfile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url?: string | null
  video_avatar_url?: string | null
  is_verified?: boolean | null
  is_team_member?: boolean | null
  is_sponsor?: boolean | null
  is_premium?: boolean | null
  is_admin?: boolean | null
  is_organization?: boolean | null
  organization_badge_url?: string | null
  organization_name?: string | null
  bio?: string | null
  interests?: string[] | null
  followers_count?: number | null
  created_at?: string | null
  last_active?: string | null
  privacy_settings?: Record<string, any> | null
}

const PROFILE_SELECT = `
  id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member,
  is_sponsor, is_premium, is_admin, is_organization, organization_badge_url,
  organization_name, bio, interests, followers_count, created_at, last_active, privacy_settings
`

const PROFILE_SELECT_FALLBACK = `
  id, username, display_name, avatar_url, video_avatar_url, is_verified, is_team_member,
  is_sponsor, is_premium, is_admin, is_organization, organization_badge_url,
  organization_name, bio, interests, followers_count, created_at, privacy_settings
`

function parseIds(raw: string | null, max = 80): string[] {
  if (!raw) return []
  const ids = new Set<string>()
  for (const value of raw.split(",")) {
    const id = value.trim()
    if (!id || id.length > 80) continue
    ids.add(id)
    if (ids.size >= max) break
  }
  return [...ids]
}

function normalizeTags(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().replace(/^#/, "").toLowerCase())
    .filter(Boolean)
}

function daysSince(value: string | null | undefined, now = Date.now()): number {
  if (!value) return 999
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 999
  return Math.max(0, (now - time) / 86_400_000)
}

async function getMutualCounts(
  supabase: ReturnType<typeof createServerClient>,
  myFollowingIds: string[],
  candidateIds: Set<string>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!myFollowingIds.length || !candidateIds.size) return counts

  // Chunking keeps the PostgREST URL bounded for people who follow hundreds.
  const chunks: string[][] = []
  for (let index = 0; index < myFollowingIds.length && index < 240; index += 80) {
    chunks.push(myFollowingIds.slice(index, index + 80))
  }

  const candidateList = [...candidateIds]
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from("follows")
        .select("follower_id, following_id")
        .in("follower_id", chunk)
        .in("following_id", candidateList)
        .limit(1500),
    ),
  )

  for (const result of results) {
    for (const row of result.data || []) {
      if (!candidateIds.has(row.following_id)) continue
      counts.set(row.following_id, (counts.get(row.following_id) || 0) + 1)
    }
  }
  return counts
}

async function getSharedCircleCounts(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  candidateIds: Set<string>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!candidateIds.size) return counts

  const { data: mine } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", userId)
    .in("status", ["active", "approved"])
    .limit(80)
  const circleIds = [...new Set((mine || []).map((row) => row.circle_id).filter(Boolean))] as string[]
  if (!circleIds.length) return counts

  const { data: theirs } = await supabase
    .from("circle_members")
    .select("user_id, circle_id")
    .in("circle_id", circleIds)
    .in("user_id", [...candidateIds])
    .in("status", ["active", "approved"])
    .limit(1000)

  for (const row of theirs || []) {
    if (!candidateIds.has(row.user_id)) continue
    counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1)
  }
  return counts
}

async function getLikedHashtags(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<Set<string>> {
  const tags = new Set<string>()
  const { data: likes } = await supabase
    .from("loop_interactions")
    .select("loop_id")
    .eq("user_id", userId)
    .eq("interaction_type", "like")
    .order("created_at", { ascending: false })
    .limit(30)
  const ids = (likes || []).map((row) => row.loop_id).filter(Boolean)
  if (!ids.length) return tags

  const { data: loops } = await supabase.from("loops").select("hashtags").in("id", ids)
  for (const loop of loops || []) {
    for (const tag of normalizeTags(loop.hashtags)) tags.add(tag)
  }
  return tags
}

async function getCandidateHashtagCounts(
  supabase: ReturnType<typeof createServerClient>,
  candidateIds: Set<string>,
  likedTags: Set<string>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!candidateIds.size || !likedTags.size) return counts

  const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const { data: loops } = await supabase
    .from("loops")
    .select("author_id, hashtags")
    .in("author_id", [...candidateIds])
    .eq("visibility", "public")
    .gte("created_at", since)
    .limit(400)

  for (const loop of loops || []) {
    const overlap = normalizeTags(loop.hashtags).filter((tag) => likedTags.has(tag)).length
    if (!overlap) continue
    counts.set(loop.author_id, (counts.get(loop.author_id) || 0) + overlap)
  }
  return counts
}

/**
 * Native Loop suggested accounts.
 *
 * Signals: mutual follows, shared circles, shared interests, engagement with
 * similar hashtags, creator quality and recent activity. Accounts the viewer
 * dismissed or has already been shown are sent by the client and excluded.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: true, suggestions: [], disabled: false })
    }

    const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit") || 3), MAX_SUGGESTIONS))
    const seen = new Set(parseIds(request.nextUrl.searchParams.get("seen")))
    const dismissed = new Set(parseIds(request.nextUrl.searchParams.get("dismissed")))

    const [followingResult, meResult, deletionsResult] = await Promise.all([
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
      supabase
        .from("profiles")
        .select("interests, discovery_preferences, privacy_settings")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("account_deletions")
        .select("user_id, cancelled, executed")
        .eq("cancelled", false)
        .eq("executed", false),
    ])

    if (followingResult.error) {
      console.error("Suggestion following lookup failed:", followingResult.error)
      return NextResponse.json({ error: "Could not load suggestions" }, { status: 500 })
    }

    const preferences = normalizeDiscoveryPreferences(meResult.data?.discovery_preferences)
    if (!preferences.personalization_enabled) {
      return NextResponse.json({ success: true, suggestions: [], disabled: true })
    }

    const followingIds = (followingResult.data || []).map((row) => row.following_id).filter(Boolean) as string[]
    const followingSet = new Set(followingIds)
    const departing = new Set((deletionsResult.data || []).map((row) => String(row.user_id)))

    let candidateRows: CandidateProfile[] | null = null
    let candidateError: { message?: string } | null = null
    const primaryCandidates = await supabase
      .from("profiles")
      .select(PROFILE_SELECT)
      .order("last_active", { ascending: false, nullsFirst: false })
      .limit(CANDIDATE_LIMIT)
    candidateRows = (primaryCandidates.data as CandidateProfile[] | null) || null
    candidateError = primaryCandidates.error

    if (candidateError) {
      const fallbackCandidates = await supabase
        .from("profiles")
        .select(PROFILE_SELECT_FALLBACK)
        .order("created_at", { ascending: false })
        .limit(CANDIDATE_LIMIT)
      candidateRows = (fallbackCandidates.data as CandidateProfile[] | null) || null
      candidateError = fallbackCandidates.error
    }

    if (candidateError) {
      console.error("Suggestion candidate lookup failed:", candidateError)
      return NextResponse.json({ error: "Could not load suggestions" }, { status: 500 })
    }

    const candidates = ((candidateRows || []) as CandidateProfile[]).filter((profile) => {
      if (!profile.id || !profile.username) return false
      if (profile.id === user.id || followingSet.has(profile.id)) return false
      if (departing.has(profile.id) || seen.has(profile.id) || dismissed.has(profile.id)) return false
      if (isGatedVisibility(profile.privacy_settings?.profile_visibility)) return false
      return true
    })

    if (!candidates.length) {
      return NextResponse.json({ success: true, suggestions: [], disabled: false })
    }

    const candidateIds = new Set(candidates.map((profile) => profile.id))
    const blockedIds = await getBlockedProfileIds(supabase, user.id, [...candidateIds])
    const visibleCandidates = candidates.filter((profile) => !blockedIds.has(profile.id))
    if (!visibleCandidates.length) {
      return NextResponse.json({ success: true, suggestions: [], disabled: false })
    }

    const visibleIds = new Set(visibleCandidates.map((profile) => profile.id))
    const myInterests = new Set(normalizeTags(meResult.data?.interests))
    const likedTags = await getLikedHashtags(supabase, user.id)

    const [mutualCounts, circleCounts, hashtagCounts] = await Promise.all([
      getMutualCounts(supabase, followingIds, visibleIds),
      getSharedCircleCounts(supabase, user.id, visibleIds),
      getCandidateHashtagCounts(supabase, visibleIds, likedTags),
    ])

    const now = Date.now()
    const scored = visibleCandidates
      .map((profile) => {
        const interests = normalizeTags(profile.interests)
        const sharedInterests = interests.filter((interest) => myInterests.has(interest))
        const mutuals = mutualCounts.get(profile.id) || 0
        const sharedCircles = circleCounts.get(profile.id) || 0
        const hashtagMatches = hashtagCounts.get(profile.id) || 0
        const activeDays = daysSince(profile.last_active, now)
        const accountDays = daysSince(profile.created_at, now)

        const quality =
          (profile.is_admin ? 8 : 0) +
          (profile.is_organization ? 4 : 0) +
          (profile.is_verified ? 4 : 0) +
          (profile.is_premium ? 2 : 0) +
          Math.min(10, Math.log1p(Math.max(0, Number(profile.followers_count) || 0)) * 1.5)
        const activity = Math.max(0, 6 - activeDays / 10)
        const rising = accountDays <= 45 && Number(profile.followers_count || 0) < 2000 ? 2 : 0

        const score =
          mutuals * 12 +
          sharedCircles * 8 +
          sharedInterests.length * 6 +
          Math.min(12, hashtagMatches) * 2 +
          quality +
          activity +
          rising -
          (dismissed.has(profile.id) ? 1000 : 0)

        const reason =
          mutuals > 0
            ? `Followed by ${mutuals} ${mutuals === 1 ? "person" : "people"} you follow`
            : sharedCircles > 0
              ? `Popular in ${sharedCircles === 1 ? "one of your circles" : `${sharedCircles} of your circles`}`
              : sharedInterests.length > 0
                ? `Shares your interest in ${sharedInterests[0]}`
                : profile.is_verified
                  ? "Verified creator on Loop"
                  : activeDays <= 7
                    ? "Active on Loop this week"
                    : "A creator worth discovering"

        const { privacy_settings: _privacySettings, ...publicProfile } = profile
        return {
          ...publicProfile,
          reason,
          score,
          mutual_count: mutuals,
          shared_circles: sharedCircles,
          shared_interests: sharedInterests,
        }
      })
      .sort((a, b) => b.score - a.score || daysSince(a.last_active, now) - daysSince(b.last_active, now))
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      suggestions: scored,
      disabled: false,
    })
  } catch (error: any) {
    console.error("suggestions error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
