import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * View-event recording for post analytics.
 *
 * `loop_interactions` keeps one `view` row per viewer forever, so it can only
 * ever answer "how many people have opened this". Analytics needs a timeline,
 * so the same interaction also records a deduplicated event here: impressions
 * over time, which surface the reader came from, and whether they follow the
 * author.
 *
 * A repeat view is counted at most once per viewer per 30 minutes. That keeps
 * a single reader scrolling back to a post from inflating its numbers, while
 * still letting a genuine return visit a day later register.
 */

export const VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000

/** Surfaces a post view can come from. Anything else is recorded as `other`. */
export const VIEW_SURFACES = [
  "feed",
  "profile",
  "circle",
  "explore",
  "shared",
  "search",
  "notification",
  "tree",
  "reel",
  "detail",
  "other",
] as const

export type ViewSurface = (typeof VIEW_SURFACES)[number]

export function normalizeSurface(value: unknown): ViewSurface {
  const surface = String(value || "").toLowerCase()
  return (VIEW_SURFACES as readonly string[]).includes(surface) ? (surface as ViewSurface) : "other"
}

/** Human labels used by the analytics UI, in display order. */
export const SURFACE_LABELS: Record<ViewSurface, string> = {
  feed: "Home feed",
  profile: "Profile",
  circle: "Circles",
  explore: "Explore",
  shared: "Shared link",
  search: "Search",
  notification: "Notifications",
  tree: "Trees",
  reel: "Reels",
  detail: "Direct",
  other: "Other",
}

export async function recordViewEvent({
  supabase,
  loopId,
  viewerId,
  sessionId,
  authorId,
  surface,
}: {
  supabase: SupabaseClient
  loopId: string
  viewerId: string
  sessionId?: string | null
  authorId: string
  surface?: unknown
}): Promise<boolean> {
  try {
    // The author reading their own post is not an audience.
    if (viewerId === authorId) return false

    const since = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS).toISOString()
    let recentQuery = supabase
      .from("loop_view_events")
      .select("id")
      .eq("loop_id", loopId)
      .gte("created_at", since)
      .limit(1)

    recentQuery = viewerId
      ? recentQuery.eq("viewer_id", viewerId)
      : recentQuery.eq("session_id", String(sessionId || ""))

    const { data: recent, error: recentError } = await recentQuery.maybeSingle()
    if (recentError) throw recentError
    if (recent) return false

    let isFollower = false
    const { data: follow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", viewerId)
      .eq("following_id", authorId)
      .maybeSingle()
    isFollower = Boolean(follow)

    const payload: Record<string, unknown> = {
      loop_id: loopId,
      viewer_id: viewerId || null,
      session_id: viewerId ? null : sessionId || null,
      surface: normalizeSurface(surface),
      is_follower: isFollower,
    }

    const { error } = await supabase.from("loop_view_events").insert(payload)
    if (error) throw error
    return true
  } catch (error) {
    // Analytics must never break reading a post.
    console.warn("recordViewEvent failed:", (error as Error)?.message)
    return false
  }
}
