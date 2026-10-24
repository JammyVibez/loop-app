/**
 * Onboarding flow model.
 *
 * The onboarding surface is a single-screen, one-question-at-a-time sequence
 * (the pattern X / Twitter uses). Everything that decides what the user sees —
 * the step order, what each step demands before "Continue" unlocks, how far the
 * progress bar has filled — lives here as pure data and functions so it can be
 * unit-tested without a React harness (see `__tests__/onboarding.test.ts`).
 */

export type OnboardingStepId =
  | "welcome"
  | "profile"
  | "interests"
  | "follow"
  | "communities"
  | "done"

export interface OnboardingStep {
  id: OnboardingStepId
  /** Big headline shown above the step body. */
  title: string
  /** Muted supporting line under the headline. */
  subtitle: string
  /** Optional steps expose a "Skip for now" escape hatch. */
  optional: boolean
}

/**
 * The canonical order. `welcome` and `done` are framed screens rather than
 * questions, but they participate in the progress bar so the sequence reads as
 * one continuous flow.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome to Loop",
    subtitle: "Loops, communities and Co-Loops — one place for the people you actually follow.",
    optional: false,
  },
  {
    id: "profile",
    title: "Make it yours",
    subtitle: "Photo, name, bio — the card people tap when they meet you.",
    optional: false,
  },
  {
    id: "interests",
    title: "What sparks your loop?",
    subtitle: "Pick a few topics — your feed and your suggested people follow them.",
    optional: true,
  },
  {
    id: "follow",
    title: "Who should you follow?",
    subtitle: "Follow three people so day one has something in it.",
    optional: true,
  },
  {
    id: "communities",
    title: "Find your people",
    subtitle: "Join a world, see its Powers and rules, and read what the members are making.",
    optional: true,
  },
  {
    id: "done",
    title: "You're all set",
    subtitle: "Your feed, your worlds and your studio are ready — the Co-Loop button sits centre stage.",
    optional: false,
  },
]

export const ONBOARDING_STEP_IDS = ONBOARDING_STEPS.map((step) => step.id)

export function stepIndex(id: OnboardingStepId): number {
  const index = ONBOARDING_STEP_IDS.indexOf(id)
  return index === -1 ? 0 : index
}

export function stepAt(index: number): OnboardingStep {
  const clamped = Math.max(0, Math.min(index, ONBOARDING_STEPS.length - 1))
  return ONBOARDING_STEPS[clamped]
}

/** Minimum follows X asks for, and the threshold Loop uses too. */
export const FOLLOW_MIN = 3

/** At least one interest must be picked before the interests step unlocks. */
export const INTEREST_MIN = 1

/** Fraction (0–1) of the flow completed at a given step, for the progress bar. */
export function onboardingProgress(id: OnboardingStepId): number {
  const last = ONBOARDING_STEPS.length - 1
  if (last <= 0) return 1
  return stepIndex(id) / last
}

export interface InterestTopic {
  /** Stored verbatim on `profiles.interests`; keep in sync with existing data. */
  label: string
  emoji: string
}

export const INTEREST_CATALOG: InterestTopic[] = [
  { label: "Gaming", emoji: "🎮" },
  { label: "Tech", emoji: "💻" },
  { label: "Art & Design", emoji: "🎨" },
  { label: "Music", emoji: "🎧" },
  { label: "Sports", emoji: "⚽" },
  { label: "Memes", emoji: "😂" },
  { label: "Anime", emoji: "🌸" },
  { label: "Fitness", emoji: "🏋️" },
  { label: "Food", emoji: "🍜" },
  { label: "Travel", emoji: "✈️" },
  { label: "Fashion", emoji: "👟" },
  { label: "Coding", emoji: "🧑‍💻" },
  { label: "Crypto & Web3", emoji: "🪙" },
  { label: "Photography", emoji: "📷" },
  { label: "Books", emoji: "📚" },
  { label: "Films & TV", emoji: "🎬" },
]

/** Keep usernames lowercase letters/digits/underscore, capped at the DB limit. */
export function sanitizeUsername(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20)
}

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
export const DISPLAY_NAME_MAX = 50
export const BIO_MAX = 220

/** Returns an error message, or `null` when the username is acceptable. */
export function validateUsername(raw: string): string | null {
  const value = sanitizeUsername(raw)
  if (value.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`
  }
  if (value.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MAX} characters or fewer.`
  }
  if (!/[a-z]/.test(value)) {
    return "Username needs at least one letter."
  }
  return null
}

/** Returns an error message, or `null` when the display name is acceptable. */
export function validateDisplayName(raw: string): string | null {
  const value = (raw || "").trim()
  if (!value) return "Add a display name so people know who you are."
  if (value.length > DISPLAY_NAME_MAX) {
    return `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`
  }
  return null
}

export interface AdvanceState {
  displayName: string
  username: string
  interests: string[]
  followingCount: number
}

/**
 * Whether the primary button on a step is unlocked. Skip stays available
 * separately via `OnboardingStep.optional`, so a user is never trapped.
 */
export function canAdvance(id: OnboardingStepId, state: AdvanceState): boolean {
  switch (id) {
    case "profile":
      return validateDisplayName(state.displayName) === null && validateUsername(state.username) === null
    case "interests":
      return state.interests.length >= INTEREST_MIN
    case "follow":
      return state.followingCount >= FOLLOW_MIN
    default:
      return true
  }
}

/** The label on the primary button, which doubles as the unmet-requirement hint. */
export function primaryLabel(id: OnboardingStepId, state: AdvanceState): string {
  if (id === "follow" && state.followingCount < FOLLOW_MIN) {
    const remaining = FOLLOW_MIN - state.followingCount
    return `Follow ${remaining} more to continue`
  }
  switch (id) {
    case "welcome":
      return "Get started"
    case "done":
      return "Enter Loop"
    default:
      return "Continue"
  }
}

export interface OnboardingSummaryInput {
  interests: string[]
  followingCount: number
  joinedCount: number
}

export interface OnboardingSummaryItem {
  id: string
  label: string
  value: number
}

/** The little stat row shown on the final screen. */
export function onboardingSummary(input: OnboardingSummaryInput): OnboardingSummaryItem[] {
  return [
    { id: "interests", label: "Interests", value: input.interests.length },
    { id: "following", label: "Following", value: input.followingCount },
    { id: "communities", label: "Communities", value: input.joinedCount },
  ]
}
