import { describe, expect, it } from "vitest"
import { canShareCircle, isShareablePost } from "@/lib/community-feed-share"

describe("community → Loop feed sharing rules", () => {
  it("never allows a private community to reach the public feed", () => {
    expect(canShareCircle({ id: 1, is_private: true })).toBe(false)
    expect(canShareCircle({ id: 1, is_private: false })).toBe(true)
    expect(canShareCircle(null)).toBe(false)
    expect(canShareCircle(undefined)).toBe(false)
  })

  it("only shares published posts that have not already been shared", () => {
    const base = { content: "A real discussion", status: "published", feed_loop_id: null }
    expect(isShareablePost(base)).toBe(true)
    // Pending moderation is not eligible.
    expect(isShareablePost({ ...base, status: "pending" })).toBe(false)
    // Already shared — never create a second mirror.
    expect(isShareablePost({ ...base, feed_loop_id: "loop-1" })).toBe(false)
  })

  it("treats media-only discussions as shareable and empty ones as not", () => {
    expect(isShareablePost({ content: "", status: "published", media_url: "https://x/y.png" })).toBe(true)
    expect(isShareablePost({ content: "", status: "published", media_urls: ["https://x/y.png"] })).toBe(true)
    expect(isShareablePost({ content: "   ", status: "published", media_url: null })).toBe(false)
  })
})
