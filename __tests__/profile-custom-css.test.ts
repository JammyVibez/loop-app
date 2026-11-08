import { describe, expect, it } from "vitest"
import { sanitizeProfileCustomCss } from "@/lib/profile-custom-css"
import { MAX_PROFILE_CUSTOM_CSS_BYTES, profileCustomCssByteLength } from "@/lib/profile-custom-css-limits"

describe("profile custom CSS", () => {
  it("uses a 21,000-byte UTF-8 limit", () => {
    const exactLimit = "/*" + "a".repeat(MAX_PROFILE_CUSTOM_CSS_BYTES - 4) + "*/"
    expect(profileCustomCssByteLength(exactLimit)).toBe(MAX_PROFILE_CUSTOM_CSS_BYTES)
    expect(() => sanitizeProfileCustomCss(exactLimit)).not.toThrow()
    expect(() => sanitizeProfileCustomCss(exactLimit + "a")).toThrow(/21,000 bytes/)
  })

  it("counts UTF-8 bytes instead of JavaScript characters", () => {
    expect(profileCustomCssByteLength("é")).toBe(2)
    const overLimit = "/*" + "é".repeat(10_499) + "*/"
    expect(profileCustomCssByteLength(overLimit)).toBeGreaterThan(MAX_PROFILE_CUSTOM_CSS_BYTES)
    expect(() => sanitizeProfileCustomCss(overLimit)).toThrow(/21,000 bytes/)
  })

  it("scopes every selector, including document-root selectors", () => {
    const css = sanitizeProfileCustomCss(
      ":root { --accent: #fff; } .card, .title:is(.large, .small) { color: red; } @media (min-width: 700px) { body .card:hover { color: blue; } }",
    )
    expect(css).toContain(".loop-profile-custom-css {")
    expect(css).toContain(".loop-profile-custom-css .card, .loop-profile-custom-css .title:is(.large, .small)")
    expect(css).toContain(".loop-profile-custom-css .card:hover")
    expect(css).not.toContain("body .card")
  })

  it("does not scope already-sanitized selectors twice", () => {
    const once = sanitizeProfileCustomCss(".card { color: red; }")
    expect(once).toContain(".loop-profile-custom-css .card")
    expect(sanitizeProfileCustomCss(once)).toBe(once)
  })

  it("namespaces keyframes and keeps animation references connected", () => {
    const css = sanitizeProfileCustomCss("@keyframes fade-in { from { opacity: 0 } to { opacity: 1 } } .card { animation: fade-in 1s ease; }")
    expect(css).toMatch(/@keyframes loop_profile_[a-z0-9]+_fade-in/)
    expect(css).toMatch(/animation: loop_profile_[a-z0-9]+_fade-in 1s ease/)
    expect(css).toContain(".loop-profile-custom-css .card")
  })

  it("does not namespace keyframes again when saved twice", () => {
    const once = sanitizeProfileCustomCss("@keyframes fade-in { to { opacity: 1 } } .card { animation: fade-in 1s; }")
    expect(sanitizeProfileCustomCss(once)).toBe(once)
  })

  it("rejects CSS whose scoped output would exceed the database byte limit", () => {
    const rules = Array.from({ length: 1_000 }, (_, index) => ".item-" + index + "{color:red}").join("\n")
    expect(profileCustomCssByteLength(rules)).toBeLessThan(MAX_PROFILE_CUSTOM_CSS_BYTES)
    expect(() => sanitizeProfileCustomCss(rules)).toThrow(/Scoped custom profile CSS/)
  })

  it.each([
    "@import url(https://example.com/a.css);",
    ".card { background-image: url(https://example.com/image.png); }",
    ".card { background-image: u\\72l(https://example.com/image.png); }",
    ".card { background-image: u\\" + "\n" + "rl(https://example.com/image.png); }",
    ".card { background-image: u/**/rl(https://example.com/image.png); }",
    "@font-face { font-family: remote; src: url(https://example.com/font.woff2); }",
    "</style><script>alert(1)</script>",
    ".card { behavior: url(#default#VML); }",
  ])("rejects unsafe or unsupported CSS: %s", (css) => {
    expect(() => sanitizeProfileCustomCss(css)).toThrow()
  })

  it("rejects unsupported at-rules and malformed CSS", () => {
    expect(() => sanitizeProfileCustomCss("@document url-prefix() { .card { color: red; } }")).toThrow(/@document/)
    expect(() => sanitizeProfileCustomCss(".card { color: red;")).toThrow(/syntax error/)
  })

  it("allows an empty stylesheet to clear profile styling", () => {
    expect(sanitizeProfileCustomCss("   ")).toBe("")
  })
})
