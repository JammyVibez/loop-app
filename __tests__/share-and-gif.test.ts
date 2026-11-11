import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// The share card reads auth/toast/router from app providers that don't exist
// in a bare render, so stub the hooks it needs.
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, getAuthHeader: () => ({}) }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }))

import { RichContent } from "@/components/content/rich-content"

describe("RichContent media", () => {
  it("loads GIFs straight from their CDN instead of the image proxy", () => {
    const html = renderToStaticMarkup(
      createElement(RichContent, { text: "look ![GIF](https://media.giphy.com/media/abc/giphy.gif)" }),
    )
    expect(html).toContain("https://media.giphy.com/media/abc/giphy.gif")
    expect(html).not.toContain("image-proxy")
  })

  it("renders a community card for the share token instead of raw text", () => {
    const html = renderToStaticMarkup(createElement(RichContent, { text: "[[cc:42]]" }))
    expect(html).not.toContain("[[cc:42]]")
    // The card starts as a loading shell until its summary arrives.
    expect(html).toContain("animate-pulse")
  })
})
