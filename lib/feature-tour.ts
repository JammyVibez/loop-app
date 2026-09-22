/**
 * Feature tour configuration + persistence.
 *
 * The tour itself is a generic spotlight engine
 * (`components/tour/coach-mark-tour.tsx`) — adding a feature to the tour is
 * just another entry in this list, no new components needed.
 */

export interface CoachMarkStep {
  id: string
  /** CSS selector for the real UI element this tip explains. */
  target: string
  /** Fallback selectors, tried in order when the primary target isn't mounted. */
  fallbackTargets?: string[]
  title: string
  body: string
  /** Preferred side for the tip card (defaults to "bottom"). */
  placement?: "top" | "bottom" | "left" | "right"
  /** Extra padding around the spotlight, in px. */
  padding?: number
}

/** Local mirror of `profiles.has_seen_feature_tour` — keeps the tour from
 *  repeating even if the profile write is blocked (offline, RLS, etc.). */
export const FEATURE_TOUR_STORAGE_KEY = "loop:feature-tour:seen"

/**
 * The on-feed tour. Each step points at a REAL element in the live feed UI
 * (matched via `data-tour` attributes); steps whose element isn't present are
 * skipped automatically, so this list can grow without breaking the tour.
 */
export const FEED_TOUR_STEPS: CoachMarkStep[] = [
  {
    id: "create",
    target: '[data-tour="create-loop"]',
    fallbackTargets: ['a[href="/create"]'],
    title: "Create a Loop",
    body: "Tap here to start a Loop — a post, a poll, a Duel, or a live co-write. Co-authored posts are Loop's whole thing.",
    placement: "left",
    padding: 10,
  },
  {
    id: "feed",
    target: '[data-tour="feed-tabs"]',
    title: "Shape your feed",
    body: "Switch between For You, Following and Trending — or filter by topic with the chips next to it.",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "duels",
    target: '[data-tour="duels"]',
    fallbackTargets: ['[data-tour="duels-entry"]'],
    title: "Duels",
    body: "Duels settle debates: two sides go head to head, the community votes, and the winner takes the pot.",
    placement: "top",
    padding: 10,
  },
  {
    id: "circles",
    target: '[data-tour="nav-circles"]',
    fallbackTargets: ['a[href="/communities"]', 'a[href="/circles"]'],
    title: "Circles",
    body: "Circles are living communities — rooms, voice, events and challenges with people who care about the same things.",
    placement: "right",
    padding: 8,
  },
  {
    id: "notifications",
    target: '[data-tour="notifications"]',
    title: "Notifications",
    body: "Likes, comments, mentions, gifts and Loop announcements all land here. The dot tells you what's new.",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "wallet",
    target: '[data-tour="wallet"]',
    fallbackTargets: ['a[href="/wallet"]'],
    title: "Your Loop Coins",
    body: "Earn coins by posting, helping and winning Duels — then spend them on gifts, boosts, cosmetics and themes.",
    placement: "bottom",
    padding: 8,
  },
  {
    id: "profile",
    target: '[data-tour="nav-profile"]',
    fallbackTargets: ['a[href="/inventory"]'],
    title: "You & your inventory",
    body: "Your avatar opens your profile, settings and inventory — themes, frames and auras you own all live there.",
    placement: "bottom",
    padding: 8,
  },
]

export function hasSeenFeatureTour(profile?: { has_seen_feature_tour?: boolean | null } | null) {
  if (profile?.has_seen_feature_tour === true) return true
  if (typeof window === "undefined") return true
  try {
    return window.localStorage.getItem(FEATURE_TOUR_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

export function markFeatureTourSeenLocally() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(FEATURE_TOUR_STORAGE_KEY, "true")
  } catch {
    /* storage unavailable — the profile flag still covers it */
  }
}

export function resetFeatureTourLocally() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(FEATURE_TOUR_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Persist `has_seen_feature_tour` on the user's profile row (best effort). */
export async function persistFeatureTourSeen(seen: boolean, authHeaders?: Record<string, string>) {
  try {
    await fetch("/api/users/update-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(authHeaders || {}) },
      body: JSON.stringify({ has_seen_feature_tour: seen }),
    })
  } catch {
    /* best effort — the local flag keeps the tour from repeating */
  }
}
