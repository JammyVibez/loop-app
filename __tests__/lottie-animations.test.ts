// @vitest-environment jsdom

/**
 * The shop's animations are written by hand in `lib/lottie/animations.ts`, so
 * nothing else would catch a malformed keyframe or a shape with no fill: the
 * mistake would only show up as a blank space in the browser. This runs every
 * animation through the real Lottie engine (the same lottie-web that
 * lottie-react bundles) and checks it actually builds geometry.
 */

import { describe, expect, it } from "vitest"
import { LOTTIE, RARITY_PALETTE, paletteForRarity, type LottieName } from "@/lib/lottie/animations"
import { ITEM_LOTTIE, type ItemLottieName } from "@/lib/lottie/item-animations"

// lottie-web probes for canvas support the moment it is imported, and jsdom has
// no 2D context to give it. The app draws with the SVG renderer, so a stub that
// swallows the probe is all it takes to load the real, shipped engine below.
const stubContext = new Proxy(
  {},
  {
    get: () => () => undefined,
    set: () => true,
  },
)
HTMLCanvasElement.prototype.getContext = (() => stubContext) as unknown as HTMLCanvasElement["getContext"]

/**
 * The engine, imported on first use — after the stub above has been installed.
 * A static import would be hoisted above it and fail before a single test ran.
 */
let engine: typeof import("lottie-web").default | null = null
async function lottie() {
  if (!engine) engine = (await import("lottie-web")).default
  return engine
}

type AnyName = LottieName | ItemLottieName

/** The generic set plus every item illustration, in one place to sweep. */
const FACTORIES: Record<AnyName, () => object> = { ...LOTTIE, ...ITEM_LOTTIE }

const NAMES = Object.keys(FACTORIES) as AnyName[]

interface Json {
  v: string
  fr: number
  ip: number
  op: number
  w: number
  h: number
  layers: Array<Record<string, any>>
}

const DRAWABLE = new Set(["sh", "rc", "el", "sr"])
const PAINT = new Set(["fl", "st", "gf", "gs"])

/**
 * A group paints only the shapes listed directly inside it: a fill in a parent
 * group does not reach into a child group, because the engine builds a separate
 * style list per element. So a nested group that draws an ellipse and defines
 * no fill of its own renders absolutely nothing — invisible in the app, and
 * invisible to any component test that only counts DOM nodes.
 */
function auditGroup(group: Record<string, any>, where: string) {
  const items: Array<Record<string, any>> = group.it
  expect(items.map((item) => item.ty), `${where} has no transform`).toContain("tr")

  items.forEach((item, index) => {
    if (DRAWABLE.has(item.ty)) {
      const painted = items.some((other, otherIndex) => otherIndex > index && PAINT.has(other.ty))
      expect(painted, `${where}: item ${index} ("${item.ty}") is drawn with no fill or stroke after it`).toBe(true)
    }
    if (item.ty === "gr") auditGroup(item, `${where} → nested group ${index}`)
  })
}

/** Each animation, as parsed JSON — i.e. what the engine actually receives. */
function json(name: AnyName): Json {
  return JSON.parse(JSON.stringify(FACTORIES[name]()))
}

/** Builds an animation in a detached container and hands back what it drew. */
async function render(name: AnyName, frame?: number) {
  const container = document.createElement("div")
  document.body.appendChild(container)

  const instance = (await lottie()).loadAnimation({
    container,
    renderer: "svg",
    loop: true,
    autoplay: false,
    animationData: json(name),
  })

  if (frame !== undefined) instance.goToAndStop(frame, true)

  return {
    instance,
    container,
    shapes: () => container.querySelectorAll("path, ellipse, rect, circle, line").length,
  }
}

describe("coded Lottie animations", () => {
  it("ships a set of animations to test", () => {
    expect(NAMES.length).toBeGreaterThanOrEqual(5)
  })

  it.each(NAMES)("%s declares a sane document", (name) => {
    const doc = json(name)
    expect(doc.v).toBeTruthy()
    expect(doc.fr).toBeGreaterThan(0)
    expect(doc.op).toBeGreaterThan(doc.ip)
    expect(doc.w).toBeGreaterThan(0)
    expect(doc.h).toBeGreaterThan(0)
    expect(Array.isArray(doc.layers)).toBe(true)
    expect(doc.layers.length).toBeGreaterThan(0)
  })

  it.each(NAMES)("%s gives every layer a unique index and a transform", (name) => {
    const doc = json(name)
    const indices = doc.layers.map((layer) => layer.ind)
    expect(new Set(indices).size).toBe(indices.length)

    for (const layer of doc.layers) {
      expect(layer.ty).toBe(4) // shape layer
      expect(layer.ip).toBe(0)
      expect(layer.op).toBeGreaterThan(0)
      for (const key of ["o", "r", "p", "a", "s"]) {
        expect(layer.ks[key], `layer "${layer.nm}" is missing ${key}`).toBeTruthy()
      }
      // A keyframed property with no keyframes renders nothing at all.
      for (const [key, prop] of Object.entries<any>(layer.ks)) {
        if (prop.a === 1) {
          expect(Array.isArray(prop.k)).toBe(true)
          expect(prop.k.length).toBeGreaterThan(1)
          for (const frame of prop.k) {
            expect(typeof frame.t).toBe("number")
            expect(frame.s.length).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it.each(NAMES)("%s animates something and paints every shape it draws", (name) => {
    const doc = json(name)
    const animated = JSON.stringify(doc).includes('"a":1')
    expect(animated).toBe(true)

    for (const layer of doc.layers) {
      expect(Array.isArray(layer.shapes)).toBe(true)
      for (const [index, group] of layer.shapes.entries()) {
        expect(group.ty).toBe("gr")
        auditGroup(group, `${name} → layer "${layer.nm}" → group ${index}`)
      }
    }
  })

  it.each(NAMES)("%s renders geometry through the real engine", async (name) => {
    const { instance, container, shapes } = await render(name)

    expect(instance.totalFrames).toBe(json(name).op - json(name).ip)
    expect(container.querySelector("svg")).not.toBeNull()

    // Frame 0 is deliberately invisible for the sparkles (they fade in), so
    // check a frame where everything has started rather than the very first.
    instance.goToAndStop(Math.floor(instance.totalFrames * 0.5), true)
    expect(shapes()).toBeGreaterThan(0)

    instance.destroy()
  })

  it("covers every item illustration, not just the generic set", () => {
    expect(Object.keys(ITEM_LOTTIE)).toContain("rose")
    expect(NAMES.length).toBeGreaterThanOrEqual(Object.keys(LOTTIE).length + Object.keys(ITEM_LOTTIE).length - 1)
  })

  it("tints an animation from the palette it is handed", () => {
    const cool = JSON.stringify(LOTTIE.coin({ accent: "#ff0000", accent2: "#00ff00" }))
    const warm = JSON.stringify(LOTTIE.coin())

    expect(cool).toContain("[1,0,0,1]") // #ff0000
    expect(cool).toContain("[0,1,0,1]") // #00ff00
    expect(warm).not.toContain("[1,0,0,1]")
  })

  it("maps rarity onto a palette, falling back to common", () => {
    expect(paletteForRarity("legendary")).toEqual(RARITY_PALETTE.legendary)
    expect(paletteForRarity("EPIC")).toEqual(RARITY_PALETTE.epic)
    expect(paletteForRarity(undefined)).toEqual(RARITY_PALETTE.common)
    expect(paletteForRarity("nonsense")).toEqual(RARITY_PALETTE.common)
  })
})
