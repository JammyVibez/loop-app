import { describe, expect, it } from "vitest"
import {
  buildProfileLayoutCss,
  DEFAULT_PROFILE_LAYOUT,
  normalizeProfileLayout,
  validateProfileLayout,
} from "@/lib/profile-layout"

describe("profile layout", () => {
  it("fills missing sections and drops unknown layout keys", () => {
    const layout = normalizeProfileLayout({
      version: 7,
      sections: ["content", "cover", "unknown", "content"],
      sidebar: ["stats", "bio", "unknown"],
      tabs: ["media", "loops", "media"],
      hidden: ["bio", "global"],
      injected: "ignored",
    })
    expect(layout.sections).toEqual(["content", "cover", "profile"])
    expect(layout.sidebar[0]).toBe("stats")
    expect(layout.sidebar).toContain("identity")
    expect(layout.tabs.slice(0, 2)).toEqual(["media", "loops"])
    expect(layout.hidden).toEqual(["bio"])
    expect((layout as any).injected).toBeUndefined()
  })

  it("prevents hiding the profile identity and main content containers", () => {
    const layout = normalizeProfileLayout({
      hidden: ["profile", "content", "identity", "avatar-actions", "cover", "bio"],
    })
    expect(layout.hidden).toEqual(["cover", "bio"])
  })

  it("rejects a non-object profile layout payload", () => {
    expect(() => validateProfileLayout("nope")).toThrow(/object/)
    expect(() => validateProfileLayout([])).toThrow(/object/)
  })

  it("exports only known, scoped selectors for layout sections", () => {
    const css = buildProfileLayoutCss({
      sections: ["content", "cover", "profile"],
      sidebar: ["bio", "stats"],
      hidden: ["cover"],
    })
    expect(css).toContain('.loop-profile-layout-canvas > [data-profile-section="content"] { order: 0; }')
    expect(css).toContain('.loop-profile-sidebar > [data-profile-block="bio"] { order: 0; }')
    expect(css).toContain('[data-profile-section="cover"], [data-profile-block="cover"] { display: none !important; }')
    expect(css).not.toContain("html")
    expect(css).not.toContain("body")
  })

  it("provides a stable default layout", () => {
    expect(normalizeProfileLayout(null)).toEqual(DEFAULT_PROFILE_LAYOUT)
  })
})
