import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { EmojiText } from "@/components/emoji/animated-emoji"
import {
  ANIMATED_EMOJI_LIST,
  emojiCodePointString,
  getAnimatedEmoji,
  searchAnimatedEmoji,
} from "@/lib/emoji/animated-emoji"

describe("animated emoji mapping", () => {
  it("maps characters to canonical codepoint filenames", () => {
    expect(emojiCodePointString("😀")).toBe("U+1F600")
    // Variation selectors are dropped so ❤️ resolves to the mirrored file.
    expect(emojiCodePointString("❤️")).toBe("U+2764")
    expect(emojiCodePointString("👨‍👩‍👧‍👦")).toBe("U+1F468_U+200D_U+1F469_U+200D_U+1F467_U+200D_U+1F466")
  })

  it("only advertises emoji that have a mirrored asset", () => {
    expect(ANIMATED_EMOJI_LIST.length).toBeGreaterThan(90)
    for (const emoji of ANIMATED_EMOJI_LIST) {
      const asset = getAnimatedEmoji(emoji)
      expect(asset?.file).toMatch(/^U\+[0-9A-F]+(_U\+[0-9A-F]+)*\.webp$/)
    }
  })

  it("searches by name", () => {
    expect(searchAnimatedEmoji("fire")).toContain("🔥")
    expect(searchAnimatedEmoji("rocket")).toContain("🚀")
    expect(searchAnimatedEmoji("zzzz")).toEqual([])
  })
})

describe("EmojiText", () => {
  it("renders mirrored emoji as animations and leaves everything else alone", () => {
    const html = renderToStaticMarkup(createElement(EmojiText, { text: "hi 😀 😍 <3" }))
    expect(html).toContain("/emojis/animated/U+1F600.webp")
    // 😍 is not mirrored, so it must stay as plain text rather than vanish.
    expect(html).toContain("😍")
    expect(html).toContain("&lt;")
  })
})
