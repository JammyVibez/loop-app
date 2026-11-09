import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  contentSecurityPolicyFor,
  frameAncestorsFor,
  isEmbeddablePath,
  securityHeadersFor,
} from "@/lib/security-headers"

/**
 * The framing policy has two requirements that pull against each other:
 * /preview/{id} must be embeddable in third-party pages (that is the whole
 * feature), and every other route must refuse to be framed (clickjacking on
 * /loopadmin, /wallet, /settings). These tests pin both, and pin that the
 * policy is defined in exactly one place.
 */

describe("framing policy", () => {
  it("allows the embed route to be framed by anyone", () => {
    expect(isEmbeddablePath("/preview/abc123")).toBe(true)
    expect(frameAncestorsFor("/preview/abc123", false)).toBe("*")

    const headers = securityHeadersFor("/preview/abc123", false)
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors *")
    // Sending X-Frame-Options alongside frame-ancestors gives the two headers
    // opposite meanings; the embed route deliberately omits it.
    expect(headers["X-Frame-Options"]).toBeUndefined()
  })

  it("refuses framing everywhere else", () => {
    const sensitive = [
      "/",
      "/loopadmin",
      "/loopadmin/quests",
      "/wallet",
      "/settings",
      "/messages",
      "/earnings",
      "/create",
    ]

    for (const pathname of sensitive) {
      expect(isEmbeddablePath(pathname)).toBe(false)
      expect(frameAncestorsFor(pathname, false)).toBe("'self'")
      expect(securityHeadersFor(pathname, false)["X-Frame-Options"]).toBe("SAMEORIGIN")
    }
  })

  it("does not mistake a lookalike path for the embed route", () => {
    expect(isEmbeddablePath("/previewer")).toBe(false)
    expect(isEmbeddablePath("/loopadmin/preview")).toBe(false)
    expect(isEmbeddablePath("/previews/1")).toBe(false)
  })

  it("sends no CSP on API responses", () => {
    expect(contentSecurityPolicyFor("/api/messages", true)).toBeNull()
    expect(securityHeadersFor("/api/messages", true)["Content-Security-Policy"]).toBeUndefined()
  })
})

describe("content security policy sources the app depends on", () => {
  const pagePolicy = contentSecurityPolicyFor("/", false) ?? ""

  it("keeps websocket signalling hosts so calls can connect", () => {
    // Without these, calls fail with "could not establish signal connection".
    expect(pagePolicy).toContain("wss://*.livekit.cloud")
    expect(pagePolicy).toContain("wss://*.100ms.live")
    expect(pagePolicy).toContain("wss://*.supabase.co")
  })

  it("lets the in-app browser load the links it opens", () => {
    // An allowlist of a few hosts here is why tapping a link from a post
    // appeared broken for most sites.
    expect(pagePolicy).toContain("frame-src 'self' https:")
  })

  it("allows our own media origin and keeps the GIF search host", () => {
    // Uploads now go to /api/media/upload (same origin) and are served from
    // /media by Nginx, so the policy must allow the app origin for images and
    // media. Direct browser uploads to Cloudinary were retired.
    expect(pagePolicy).toContain("img-src 'self'")
    expect(pagePolicy).toContain("media-src 'self'")
    expect(pagePolicy).toContain("https://res.cloudinary.com")
    expect(pagePolicy).not.toContain("https://api.cloudinary.com")
    expect(pagePolicy).toContain("https://tenor.googleapis.com")
  })
})

describe("the policy is defined in exactly one place", () => {
  it("next.config.mjs does not send a competing CSP or framing header", () => {
    const config = readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8")
      // Strip comments first: the file explains why these headers are absent,
      // and naming them in prose must not read as defining them.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")

    // If this ever regresses, two policies reach the browser again and only one
    // of them wins — silently, which is how the embed feature broke.
    expect(config).not.toContain("Content-Security-Policy")
    expect(config).not.toContain("frame-ancestors")
    expect(config).not.toContain("X-Frame-Options")
  })
})
