/**
 * Quote notifications.
 *
 * When someone builds a post on top of your words, the notification has to read
 * as that person quoting you — not as an anonymous interaction, and not as
 * platform copy. The same copy feeds the dropdown, the notifications page and
 * the push payload.
 */

import { describe, expect, it } from "vitest"
import { getNotificationCopy, isSystemNotificationType } from "@/lib/notification-copy"

describe("quote notifications", () => {
  it("attributes the quote to the person who posted it", () => {
    const copy = getNotificationCopy({
      type: "quote",
      title: "Ada quoted your post",
      actorName: "Ada",
    })
    expect(copy).toEqual({ sender: "Ada", action: "quoted your post", system: false })
  })

  it("is not treated as platform-originated", () => {
    expect(isSystemNotificationType("quote")).toBe(false)
  })

  it("never falls back to generic interaction copy", () => {
    const copy = getNotificationCopy({ type: "quote", actorName: "Ada" })
    expect(copy.action).not.toMatch(/interacted/i)
  })
})
