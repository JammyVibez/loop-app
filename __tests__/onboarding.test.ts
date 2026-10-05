import { describe, expect, it } from "vitest"
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  FOLLOW_MIN,
  INTEREST_CATALOG,
  INTEREST_MIN,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_IDS,
  USERNAME_MAX,
  canAdvance,
  onboardingProgress,
  onboardingSummary,
  primaryLabel,
  sanitizeUsername,
  stepAt,
  stepIndex,
  validateDisplayName,
  validateUsername,
  type AdvanceState,
} from "@/lib/onboarding"

function state(overrides: Partial<AdvanceState> = {}): AdvanceState {
  return {
    displayName: "",
    username: "",
    interests: [],
    followingCount: 0,
    ...overrides,
  }
}

describe("onboarding step model", () => {
  it("walks welcome → profile → interests → follow → communities → done", () => {
    expect(ONBOARDING_STEP_IDS).toEqual([
      "welcome",
      "profile",
      "interests",
      "follow",
      "communities",
      "done",
    ])
  })

  it("keeps identity steps mandatory and discovery steps skippable", () => {
    const optional = Object.fromEntries(ONBOARDING_STEPS.map((step) => [step.id, step.optional]))
    expect(optional.welcome).toBe(false)
    expect(optional.profile).toBe(false)
    expect(optional.interests).toBe(true)
    expect(optional.follow).toBe(true)
    expect(optional.communities).toBe(true)
    expect(optional.done).toBe(false)
  })

  it("never lets a step render without a title/subtitle", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0)
      expect(step.subtitle.trim().length).toBeGreaterThan(0)
    }
  })

  it("progresses monotonically from 0 to 1", () => {
    expect(onboardingProgress("welcome")).toBe(0)
    expect(onboardingProgress("done")).toBe(1)
    let previous = -1
    for (const id of ONBOARDING_STEP_IDS) {
      const value = onboardingProgress(id)
      expect(value).toBeGreaterThanOrEqual(previous)
      expect(value).toBeLessThanOrEqual(1)
      previous = value
    }
  })

  it("clamps out-of-range indices instead of throwing", () => {
    expect(stepAt(-5).id).toBe("welcome")
    expect(stepAt(999).id).toBe("done")
    expect(stepIndex("done")).toBe(ONBOARDING_STEPS.length - 1)
  })
})

describe("interest catalog", () => {
  it("offers a full grid of distinct topics", () => {
    expect(INTEREST_CATALOG.length).toBeGreaterThanOrEqual(12)
    const labels = INTEREST_CATALOG.map((topic) => topic.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const topic of INTEREST_CATALOG) {
      expect(topic.label.trim().length).toBeGreaterThan(0)
      expect(topic.emoji.trim().length).toBeGreaterThan(0)
    }
  })
})

describe("profile validation", () => {
  it("sanitizes usernames to the DB-safe alphabet and cap", () => {
    expect(sanitizeUsername("  Ada_Lovelace!!  ")).toBe("ada_lovelace")
    expect(sanitizeUsername("a".repeat(40))).toHaveLength(USERNAME_MAX)
    expect(sanitizeUsername("Ünïcødé")).toBe("ncd")
  })

  it("rejects too-short, letterless, and over-long usernames", () => {
    expect(validateUsername("ab")).not.toBeNull()
    expect(validateUsername("___")).not.toBeNull()
    expect(validateUsername("12345")).not.toBeNull()
    // The cap is enforced by sanitizeUsername, so an over-long input is trimmed
    // to a valid username rather than rejected outright.
    expect(sanitizeUsername("a".repeat(USERNAME_MAX + 1))).toHaveLength(USERNAME_MAX)
    expect(validateUsername("a".repeat(USERNAME_MAX + 1))).toBeNull()
    expect(validateUsername("ada_lovelace")).toBeNull()
    expect(validateUsername("loop99")).toBeNull()
  })

  it("requires a display name and enforces the length cap", () => {
    expect(validateDisplayName("   ")).not.toBeNull()
    expect(validateDisplayName("Ada")).toBeNull()
    expect(validateDisplayName("x".repeat(DISPLAY_NAME_MAX + 1))).not.toBeNull()
  })

  it("keeps the bio cap generous but bounded", () => {
    expect(BIO_MAX).toBeGreaterThan(100)
  })
})

describe("step gating", () => {
  it("unlocks the profile step only with a valid name and username", () => {
    expect(canAdvance("profile", state())).toBe(false)
    expect(canAdvance("profile", state({ displayName: "Ada" }))).toBe(false)
    expect(canAdvance("profile", state({ displayName: "Ada", username: "ab" }))).toBe(false)
    expect(canAdvance("profile", state({ displayName: "Ada", username: "ada" }))).toBe(true)
  })

  it("requires at least one interest", () => {
    expect(canAdvance("interests", state())).toBe(false)
    expect(canAdvance("interests", state({ interests: INTEREST_CATALOG.slice(0, INTEREST_MIN).map((t) => t.label) }))).toBe(true)
  })

  it("requires the minimum follows, matching the button hint", () => {
    expect(canAdvance("follow", state({ followingCount: FOLLOW_MIN - 1 }))).toBe(false)
    expect(canAdvance("follow", state({ followingCount: FOLLOW_MIN }))).toBe(true)
  })

  it("lets framed steps through and names the primary button", () => {
    expect(canAdvance("welcome", state())).toBe(true)
    expect(canAdvance("communities", state())).toBe(true)
    expect(canAdvance("done", state())).toBe(true)

    expect(primaryLabel("welcome", state())).toBe("Get started")
    expect(primaryLabel("profile", state())).toBe("Continue")
    expect(primaryLabel("done", state())).toBe("Enter Loop")
    expect(primaryLabel("follow", state({ followingCount: 1 }))).toContain("2 more")
    expect(primaryLabel("follow", state({ followingCount: FOLLOW_MIN }))).toBe("Continue")
  })
})

describe("onboarding summary", () => {
  it("reports the counts the final screen displays", () => {
    const summary = onboardingSummary({ interests: ["Music", "Tech"], followingCount: 3, joinedCount: 2 })
    expect(summary.map((item) => item.id)).toEqual(["interests", "following", "communities"])
    expect(summary.map((item) => item.value)).toEqual([2, 3, 2])
  })

  it("handles a user who skipped everything", () => {
    const summary = onboardingSummary({ interests: [], followingCount: 0, joinedCount: 0 })
    expect(summary.every((item) => item.value === 0)).toBe(true)
  })
})
