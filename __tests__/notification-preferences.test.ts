import { describe, expect, it } from "vitest"
import { getPushSuppressionReason } from "@/lib/notification-preferences"

describe("push notification preferences", () => {
  const quietHours = {
    enabled: true,
    start: "22:00",
    end: "07:00",
    time_zone: "UTC",
  }

  it("does not suppress push when quiet hours are disabled", () => {
    expect(getPushSuppressionReason({ quiet_hours: { ...quietHours, enabled: false } }, "system", new Date("2026-11-02T23:00:00Z"))).toBeNull()
  })

  it("suppresses push inside a normal quiet-hours window", () => {
    expect(getPushSuppressionReason({
      quiet_hours: { ...quietHours, start: "09:00", end: "17:00" },
    }, "system", new Date("2026-11-02T12:30:00Z"))).toBe("quiet_hours")
  })

  it("handles quiet-hours windows that cross midnight", () => {
    expect(getPushSuppressionReason({ quiet_hours: quietHours }, "system", new Date("2026-11-02T23:30:00Z"))).toBe("quiet_hours")
    expect(getPushSuppressionReason({ quiet_hours: quietHours }, "system", new Date("2026-11-03T06:59:00Z"))).toBe("quiet_hours")
  })

  it("allows delivery at the exact end boundary", () => {
    expect(getPushSuppressionReason({ quiet_hours: quietHours }, "system", new Date("2026-11-03T07:00:00Z"))).toBeNull()
  })

  it("uses the stored IANA timezone rather than server timezone", () => {
    const preferences = {
      quiet_hours: { enabled: true, start: "18:00", end: "20:00", time_zone: "America/New_York" },
    }
    expect(getPushSuppressionReason(preferences, "system", new Date("2026-11-02T23:30:00Z"))).toBe("quiet_hours")
    expect(getPushSuppressionReason(preferences, "system", new Date("2026-11-02T21:30:00Z"))).toBeNull()
  })

  it("honours global and category-specific push opt-outs", () => {
    expect(getPushSuppressionReason({ push: false }, "system")).toBe("prefs_disabled")
    expect(getPushSuppressionReason({ direct_messages: false }, "directMessages")).toBe("prefs_disabled")
    expect(getPushSuppressionReason({ likes: false }, "social")).toBe("prefs_disabled")
  })

  it("fails closed for invalid enabled quiet-hours configuration", () => {
    expect(getPushSuppressionReason({
      quiet_hours: { enabled: true, start: "25:00", end: "08:00", time_zone: "UTC" },
    }, "system", new Date("2026-11-02T12:00:00Z"))).toBe("quiet_hours")
    expect(getPushSuppressionReason({
      quiet_hours: { enabled: true, start: "22:00", end: "08:00", time_zone: "Not/A_Timezone" },
    }, "system", new Date("2026-11-02T12:00:00Z"))).toBe("quiet_hours")
  })

  it("treats matching enabled times as a full-day quiet period", () => {
    expect(getPushSuppressionReason({
      quiet_hours: { enabled: true, start: "08:00", end: "08:00", time_zone: "UTC" },
    }, "system", new Date("2026-11-02T12:00:00Z"))).toBe("quiet_hours")
  })
})
