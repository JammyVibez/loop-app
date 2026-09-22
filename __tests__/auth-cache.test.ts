// @vitest-environment jsdom

/**
 * Session cache for hard refreshes.
 *
 * The cache exists so a refresh can fall back to the signed-in UI instead of
 * collapsing into a guest view when the session check can't complete. The
 * load-bearing property is that it must never hold a replayable credential —
 * only presentation data.
 */

import { beforeEach, describe, expect, it } from "vitest"
import {
  AUTH_USER_CACHE_KEY,
  readCachedUser,
  stripCredentials,
  writeCachedUser,
} from "@/lib/auth-cache"

const user = {
  id: "4c1f1f9e-6f1e-4a4e-8f2e-2a3b4c5d6e7f",
  email: "ada@example.com",
  username: "ada",
  display_name: "Ada",
  loop_coins: 120,
  is_admin: false,
  token: "session-id-abc",
  access_token: "super-secret-session-token",
  user_metadata: { username: "ada", display_name: "Ada" },
}

beforeEach(() => {
  window.localStorage.clear()
})

describe("stripCredentials", () => {
  it("drops the session token and access token", () => {
    const cached = stripCredentials(user)
    expect(cached).not.toHaveProperty("token")
    expect(cached).not.toHaveProperty("access_token")
  })

  it("keeps the presentation data the UI needs", () => {
    const cached = stripCredentials(user)
    expect(cached.id).toBe(user.id)
    expect(cached.username).toBe("ada")
    expect(cached.display_name).toBe("Ada")
    expect(cached.loop_coins).toBe(120)
    expect(cached.user_metadata).toEqual({ username: "ada", display_name: "Ada" })
  })

  it("does not mutate the caller's object", () => {
    stripCredentials(user)
    expect(user.token).toBe("session-id-abc")
  })
})

describe("writeCachedUser / readCachedUser", () => {
  it("round-trips the identity without any credential", () => {
    writeCachedUser(user)
    const raw = window.localStorage.getItem(AUTH_USER_CACHE_KEY)!

    // Nothing secret may appear in storage, under any key.
    expect(raw).not.toContain("super-secret-session-token")
    expect(raw).not.toContain("session-id-abc")

    const cached = readCachedUser<typeof user>()
    expect(cached?.id).toBe(user.id)
    expect(cached?.username).toBe("ada")
  })

  it("clears the entry on a null write (sign-out)", () => {
    writeCachedUser(user)
    expect(readCachedUser()).not.toBeNull()
    writeCachedUser(null)
    expect(readCachedUser()).toBeNull()
    expect(window.localStorage.getItem(AUTH_USER_CACHE_KEY)).toBeNull()
  })

  it("rejects corrupt or identity-less entries", () => {
    window.localStorage.setItem(AUTH_USER_CACHE_KEY, "not json{")
    expect(readCachedUser()).toBeNull()

    window.localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify({ username: "ghost" }))
    expect(readCachedUser()).toBeNull()

    window.localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify({ id: "" }))
    expect(readCachedUser()).toBeNull()

    window.localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(["ada"]))
    expect(readCachedUser()).toBeNull()
  })

  it("never resurrects anything because storage threw", () => {
    const original = window.localStorage.setItem
    window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError")
    }
    expect(() => writeCachedUser(user)).not.toThrow()
    window.localStorage.setItem = original
  })
})
