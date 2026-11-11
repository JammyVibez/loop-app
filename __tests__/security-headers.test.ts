import { describe, expect, it } from "vitest"
import { contentSecurityPolicyFor } from "@/lib/security-headers"

describe("content security policy", () => {
  it("allows the GIF providers and avatar fallbacks the app loads", () => {
    const csp = contentSecurityPolicyFor("/", false)
    expect(csp).toBeTruthy()
    for (const host of ["media.giphy.com", "*.giphy.com", "media.tenor.com", "*.tenor.com", "api.dicebear.com"]) {
      expect(csp).toContain(host)
    }
    expect(csp).toMatch(/img-src[^;]*media\.giphy\.com/)
    expect(csp).toMatch(/img-src[^;]*api\.dicebear\.com/)
  })
})
