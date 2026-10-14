/**
 * OG engine: parsing and metadata only.
 *
 * The templates themselves are pure satori markup — what is worth protecting
 * is that every legacy URL still resolves, that long/unsafe text is trimmed,
 * and that the metadata always points at a 1200x630 image on /api/og.
 */

import { describe, expect, it } from "vitest"
import { cleanText, formatCount, initials, parseBool, parseColors, parseStat, truncate } from "@/lib/og/text"
import { DEFAULT_TITLE, normalizeType, parseOgParams } from "@/lib/og/params"
import { buildOgMetadata, ogImageUrl, personParam } from "@/lib/og/metadata"
import { accentFor } from "@/lib/og/theme"
import {
  ChallengeTemplate,
  CoLoopTemplate,
  CommunityTemplate,
  DuelTemplate,
  EventTemplate,
  FallbackTemplate,
  HomeTemplate,
  type OgPayload,
  PostTemplate,
  ProfileTemplate,
  ProjectTemplate,
  ReelTemplate,
  SpaceTemplate,
} from "@/lib/og/templates"

const params = (query: string) => new URLSearchParams(query)

describe("og text helpers", () => {
  it("truncates on a word boundary and adds an ellipsis", () => {
    const out = truncate("the quick brown fox jumps over the lazy dog", 20)
    expect(out.endsWith("…")).toBe(true)
    expect(out.length).toBeLessThanOrEqual(21)
    expect(out).not.toContain("  ")
  })

  it("leaves short text untouched and collapses whitespace", () => {
    expect(truncate("  hello   world ", 40)).toBe("hello world")
  })

  it("strips emoji and control characters so satori cannot draw tofu", () => {
    expect(cleanText("Ship it 🚀🔥 now")).toBe("Ship it now")
    expect(cleanText("line\u0000break")).toBe("line break")
  })

  it("parses stats written as numbers, thousands or shorthand", () => {
    expect(parseStat("1,234")).toBe(1234)
    expect(parseStat("1.2k")).toBe(1200)
    expect(parseStat("3M")).toBe(3_000_000)
    expect(parseStat("nope")).toBe(0)
  })

  it("formats counts compactly", () => {
    expect(formatCount(999)).toBe("999")
    expect(formatCount(1200)).toBe("1.2k")
    expect(formatCount(2_500_000)).toBe("2.5M")
  })

  it("builds a monogram", () => {
    expect(initials("real io")).toBe("RI")
    expect(initials("")).toBe("L")
  })

  it("keeps at most two hex colours for custom badges", () => {
    expect(parseColors("#FF0000", "00ff00")).toEqual(["#FF0000", "#00ff00"])
    expect(parseColors("javascript:alert(1)", null)).toBeUndefined()
  })

  it("parses booleans from query strings", () => {
    expect(parseBool("true")).toBe(true)
    expect(parseBool("1")).toBe(true)
    expect(parseBool("false")).toBe(false)
    expect(parseBool(null)).toBe(false)
  })
})

describe("og type resolution", () => {
  it("maps every legacy type onto a template", () => {
    expect(normalizeType("loop")).toBe("post")
    expect(normalizeType("developer")).toBe("post")
    expect(normalizeType("moment")).toBe("reel")
    expect(normalizeType("quest")).toBe("challenge")
    expect(normalizeType("circle")).toBe("community")
    expect(normalizeType("co-loop")).toBe("coloop")
  })

  it("falls back for unknown or missing types", () => {
    expect(normalizeType("who-knows")).toBe("fallback")
    expect(normalizeType(null)).toBe("home")
  })
})

describe("og query parsing", () => {
  it("defaults title and description when the query omits them", () => {
    const draft = parseOgParams(params("type=home"))
    expect(draft.title).toBe(DEFAULT_TITLE)
    expect(draft.description.length).toBeGreaterThan(20)
  })

  it("trims long content instead of letting it break a layout", () => {
    const draft = parseOgParams(params(`type=post&body=${"x".repeat(900)}&description=${"y".repeat(400)}`))
    expect(draft.body!.length).toBeLessThanOrEqual(560)
    expect(draft.description.length).toBeLessThanOrEqual(190)
  })

  it("collects contributors from both the list and indexed forms", () => {
    const draft = parseOgParams(params("type=coloop&people=A|a.png,B|b.png&p3=C|c.png"))
    expect(draft.people.map((p) => p.name)).toEqual(["A", "B", "C"])
  })

  it("de-duplicates the same contributor sent twice", () => {
    const draft = parseOgParams(params("type=coloop&people=A|a.png&p1=A|a.png"))
    expect(draft.people).toHaveLength(1)
  })

  it("reads duel sides, progress and date blocks", () => {
    const draft = parseOgParams(
      params("type=duel&side1=Ada|a.png&side2=Grace|g.png&progress=57|100|Followers&date_day=9&date_month=Mar"),
    )
    expect(draft.sides.map((s) => s.name)).toEqual(["Ada", "Grace"])
    expect(draft.progress).toEqual({ value: 57, max: 100, label: "Followers" })
    expect(draft.dateBlock).toEqual({ day: "9", month: "Mar" })
  })

  it("ignores a progress bar with no maximum", () => {
    expect(parseOgParams(params("type=challenge&progress_value=5")).progress).toBeUndefined()
  })

  it("labels a private community without leaking its name into a category", () => {
    const draft = parseOgParams(params("type=community&is_private=true"))
    expect(draft.category).toBe("Private")
  })

  it("reads extra stat readouts", () => {
    const draft = parseOgParams(params("type=project&stats=12|stars,3|forks"))
    expect(draft.extraStats).toEqual([
      { value: "12", label: "stars" },
      { value: "3", label: "forks" },
    ])
  })
})

describe("og metadata", () => {
  it("drops empty and false params from the image URL", () => {
    const url = ogImageUrl("https://loopapp.me", {
      type: "post",
      title: "Hi",
      avatar: "",
      verified: false,
      stat: undefined,
    })
    expect(url).toBe("https://loopapp.me/api/og?type=post&title=Hi")
  })

  it("encodes a person as name|avatar", () => {
    expect(personParam("Real", "https://x/y.png")).toBe("Real|https://x/y.png")
    expect(personParam("", "")).toBeUndefined()
  })

  it("points og:image and twitter:image at the same 1200x630 card", () => {
    const meta = buildOgMetadata({
      baseUrl: "https://loopapp.me",
      path: "/loop/42",
      type: "post",
      title: "A post",
      description: "Body text",
      params: { username: "real_io" },
    })
    const og = meta.openGraph!.images as any[]
    const tw = meta.twitter!.images as any[]
    expect(og[0].url).toBe(tw[0].url)
    expect(og[0].url).toContain("/api/og?type=post")
    expect(og[0].width).toBe(1200)
    expect(og[0].height).toBe(630)
    expect(tw[0].width).toBe(1200)
    expect((meta.twitter as { card?: string }).card).toBe("summary_large_image")
    expect(meta.alternates!.canonical).toBe("https://loopapp.me/loop/42")
  })

  it("keeps robots directives when a page asks for them", () => {
    const meta = buildOgMetadata({
      baseUrl: "https://loopapp.me",
      path: "/profile/ghost",
      type: "profile",
      title: "Account deleted",
      description: "This account is no longer available.",
      robots: { index: false, follow: false },
    })
    expect(meta.robots).toEqual({ index: false, follow: false })
  })
})

/*
 * Satori only accepts a <div> with more than one child (or a single non-string
 * child) when it declares an explicit `display`. Getting this wrong throws at
 * render time, so the whole card 500s. Walking the trees here catches it in CI
 * instead of in production.
 */
function flattenChildren(children: unknown): unknown[] {
  const out: unknown[] = []
  const push = (child: unknown) => {
    if (child === null || child === undefined || typeof child === "boolean" || child === "") return
    if (Array.isArray(child)) {
      child.forEach(push)
      return
    }
    out.push(child)
  }
  push(children)
  return out
}

interface ElementLike {
  type?: unknown
  props?: { children?: unknown; style?: Record<string, unknown> }
}

function findFlexViolations(node: unknown, path: string, acc: string[]): void {
  if (node === null || node === undefined || typeof node !== "object") return
  if (Array.isArray(node)) {
    node.forEach((child, i) => findFlexViolations(child, `${path}[${i}]`, acc))
    return
  }
  const el = node as ElementLike
  if (typeof el.type === "function") {
    const name = (el.type as { name?: string }).name || "Component"
    findFlexViolations((el.type as (props: unknown) => unknown)(el.props), `${path}<${name}>`, acc)
    return
  }
  const children = flattenChildren(el.props?.children)
  const display = el.props?.style?.display
  if (el.type === "div") {
    const needsFlex = children.length > 1 || (children.length === 1 && typeof children[0] !== "string")
    if (needsFlex && display !== "flex" && display !== "none") {
      acc.push(`${path} (${children.length} child nodes, display=${String(display)})`)
    }
  }
  children.forEach((child, i) => {
    if (typeof child !== "string") findFlexViolations(child, `${path}/${String(el.type)}.${i}`, acc)
  })
}

describe("og template layout guard", () => {
  const payload = (type: string, over: Partial<OgPayload> = {}): OgPayload => ({
    accent: accentFor(type),
    title: "Title here",
    description: "Description here",
    ...over,
  })

  const cases: [string, (props: { p: OgPayload }) => unknown, OgPayload][] = [
    ["home", HomeTemplate, payload("home")],
    ["post", PostTemplate, payload("post", { name: "Real", username: "real_io", body: "Hello", stat: 445, statLabel: "likes", verified: true })],
    ["profile", ProfileTemplate, payload("profile", { name: "Real", username: "real_io", description: "bio", stat: 57, statLabel: "followers", verified: true, premium: true })],
    ["community", CommunityTemplate, payload("community", { name: "Loop Builders", category: "Gaming", stat: 1204, statLabel: "members" })],
    ["space", SpaceTemplate, payload("space", { name: "Design Space", category: "Design" })],
    ["duel", DuelTemplate, payload("duel", { sides: [{ name: "Ada" }, { name: "Grace" }], date: "Live now" })],
    ["coloop", CoLoopTemplate, payload("coloop", { people: [{ name: "Ada" }, { name: "Grace" }], date: "Open invite" })],
    ["reel", ReelTemplate, payload("reel", { name: "Real", username: "real_io", body: "clip", stat: 812, statLabel: "views" })],
    ["reel/nomedia", ReelTemplate, payload("reel", { name: "Real", body: "no media" })],
    ["project", ProjectTemplate, payload("project", { name: "Real", extraStats: [{ value: "128", label: "stars" }], category: "TypeScript" })],
    ["event", EventTemplate, payload("event", { dateBlock: { day: "9", month: "Mar" }, category: "Community", stat: 42, statLabel: "going" })],
    ["challenge", ChallengeTemplate, payload("challenge", { progress: { value: 57, max: 100, label: "Followers" } })],
    ["fallback", FallbackTemplate, payload("fallback", { name: "Something", category: "Loop" })],
  ]

  it.each(cases)("%s declares display on every multi-child div", (_label, Template, p) => {
    const violations: string[] = []
    findFlexViolations(Template({ p }), _label as string, violations)
    expect(violations).toEqual([])
  })
})
