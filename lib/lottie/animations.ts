/**
 * The app's Lottie animations.
 *
 * Written in code rather than downloaded, so they can be tinted per usage
 * (rarity, theme accent) and reviewed in a diff. Each factory returns a plain
 * Bodymovin-shaped object that lottie-web parses exactly like a `.json` file.
 *
 * Conventions, matching what Bodymovin exports so the engine never has to
 * guess: positions carry a third `z` component, scales carry a third `z`
 * component of 100, rotations and opacities are scalars.
 */

import { anim, animation, ellipse, fill, group, polygon, polyline, rect, seconds, shapeLayer, stroke, type LottieProp, type ShapeItem } from "./build"

export interface LottiePalette {
  /** What the animation is made of. */
  accent: string
  /** Detail, highlights, secondary marks. */
  accent2: string
  /** Deep surface for holes, wells and cut-outs. */
  surface: string
}

export const DEFAULT_PALETTE: LottiePalette = {
  accent: "#8b5cf6",
  accent2: "#22d3ee",
  surface: "#0b0f1e",
}

function palette(input: Partial<LottiePalette> = {}): LottiePalette {
  return { ...DEFAULT_PALETTE, ...input }
}

function pos(x: number, y: number) {
  return [x, y, 0]
}

function scale(x: number, y: number) {
  return [x, y, 100]
}

/** A four-point sparkle. */
function sparkle(size: number, color: string, opacity = 100): ShapeItem {
  const tip = size
  const waist = size * 0.32
  return group([
    polygon([
      [0, -tip],
      [waist, 0],
      [0, tip],
      [-waist, 0],
    ]),
    fill(color, opacity),
  ])
}

/* ────────────────────────────────────────────────────────────────
   Coin — the balance / coin-pack mark. Flips on its axis while an
   outer ring of studs rotates behind it.
   ──────────────────────────────────────────────────────────────── */

export function coinAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2, surface } = palette(input)
  const frames = seconds(3)

  /** One half-turn of the coin, so the squash reads as a flip. */
  const flip: LottieProp = anim([
    { t: 0, v: scale(100, 100) },
    { t: frames * 0.25, v: scale(14, 112) },
    { t: frames * 0.5, v: scale(100, 100) },
    { t: frames * 0.75, v: scale(14, 112) },
    { t: frames, v: scale(100, 100) },
  ])

  const studs: ShapeItem = group([
    ellipse(13, [0, -44]),
    ellipse(13, [44, 0]),
    ellipse(13, [0, 44]),
    ellipse(13, [-44, 0]),
    fill(accent2, 75),
  ])

  const face: ShapeItem = group([ellipse(74), fill(accent), stroke(3, accent2, 65)])
  const inner: ShapeItem = group([ellipse(52), fill(accent2, 30)])
  const emblem: ShapeItem = group([ellipse(20), fill(surface, 85)])

  return animation({
    name: "Loop coin",
    frames,
    layers: [
      shapeLayer({
        name: "coin",
        shapes: [emblem, inner, face],
        position: anim([
          { t: 0, v: pos(60, 56) },
          { t: frames * 0.5, v: pos(60, 66) },
          { t: frames, v: pos(60, 56) },
        ]),
        scale: flip,
        outPoint: frames,
      }),
      shapeLayer({
        name: "studs",
        shapes: [studs],
        position: pos(60, 61),
        rotation: anim([
          { t: 0, v: 0 },
          { t: frames, v: 360 },
        ]),
        opacity: 90,
        outPoint: frames,
      }),
    ],
  })
}

/* ────────────────────────────────────────────────────────────────
   Sparkles — the celebratory mark. Used one-shot after a purchase
   and as a looping accent on spotlight items.
   ──────────────────────────────────────────────────────────────── */

export function sparkleAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(2)

  const rays: Array<{ x: number; y: number; size: number; color: string; delay: number }> = [
    { x: 60, y: 22, size: 15, color: accent2, delay: 0 },
    { x: 96, y: 46, size: 11, color: accent, delay: 8 },
    { x: 88, y: 92, size: 13, color: accent2, delay: 16 },
    { x: 32, y: 94, size: 12, color: accent, delay: 24 },
    { x: 22, y: 44, size: 14, color: accent2, delay: 32 },
  ]

  const rayLayers = rays.map((ray) =>
    shapeLayer({
      name: `sparkle-${ray.x}-${ray.y}`,
      shapes: [sparkle(ray.size, ray.color)],
      position: anim([
        { t: 0, v: pos(60, 60) },
        { t: ray.delay, v: pos(60, 60) },
        { t: ray.delay + 26, v: pos(ray.x, ray.y) },
        { t: frames, v: pos(ray.x, ray.y) },
      ]),
      scale: anim([
        { t: 0, v: scale(0, 0) },
        { t: ray.delay, v: scale(0, 0) },
        { t: ray.delay + 18, v: scale(110, 110) },
        { t: ray.delay + 34, v: scale(70, 70) },
        { t: frames, v: scale(0, 0) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: ray.delay, v: 0 },
        { t: ray.delay + 16, v: 100 },
        { t: ray.delay + 40, v: 0 },
        { t: frames, v: 0 },
      ]),
      outPoint: frames,
    }),
  )

  const core = shapeLayer({
    name: "core",
    shapes: [sparkle(24, accent), sparkle(11, accent2)],
    position: pos(60, 60),
    // A four-point sparkle repeats every 90°, so a full turn loops seamlessly.
    rotation: anim([
      { t: 0, v: 0 },
      { t: frames, v: 90 },
    ]),
    scale: anim([
      { t: 0, v: scale(40, 40) },
      { t: frames * 0.5, v: scale(118, 118) },
      { t: frames, v: scale(40, 40) },
    ]),
    opacity: anim([
      { t: 0, v: 100 },
      { t: frames * 0.42, v: 55 },
      { t: frames, v: 100 },
    ]),
    outPoint: frames,
  })

  return animation({ name: "Loop sparkles", frames, layers: [core, ...rayLayers] })
}

/* ────────────────────────────────────────────────────────────────
   Loader — three dots, for anything waiting on the network.
   ──────────────────────────────────────────────────────────────── */

export function loaderAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(1.4)

  const dots = [40, 60, 80].map((x, index) =>
    shapeLayer({
      name: `dot-${index}`,
      shapes: [group([ellipse(index === 1 ? 20 : 14), fill(index === 1 ? accent : accent2)])],
      position: anim([
        { t: 0, v: pos(x, 60) },
        { t: frames * 0.28, v: pos(x, 46) },
        { t: frames * 0.56, v: pos(x, 60) },
        { t: frames, v: pos(x, 60) },
      ]),
      opacity: anim([
        { t: 0, v: 55 },
        { t: frames * 0.28, v: 100 },
        { t: frames * 0.56, v: 55 },
        { t: frames, v: 55 },
      ]),
      outPoint: frames,
    }),
  )

  // Centre dot leaves first so the three read as a wave.
  return animation({ name: "Loop loader", frames, layers: [dots[1], dots[0], dots[2]] })
}

/* ────────────────────────────────────────────────────────────────
   Empty box — an empty shelf. Nothing here yet, but the lid is off.
   ──────────────────────────────────────────────────────────────── */

export function emptyBoxAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2, surface } = palette(input)
  const frames = seconds(3)
  const bob = anim([
    { t: 0, v: pos(60, 10) },
    { t: frames * 0.5, v: pos(60, 4) },
    { t: frames, v: pos(60, 10) },
  ])

  const box = shapeLayer({
    name: "box",
    shapes: [group([rect([62, 46], 8), fill(surface), stroke(3, accent, 80)])],
    position: bob,
    outPoint: frames,
  })

  const tape = shapeLayer({
    name: "tape",
    shapes: [group([rect([34, 3], 2), fill(accent, 45)])],
    position: anim([
      { t: 0, v: pos(60, 6) },
      { t: frames * 0.5, v: pos(60, 0) },
      { t: frames, v: pos(60, 6) },
    ]),
    opacity: 70,
    outPoint: frames,
  })

  const lid = shapeLayer({
    name: "lid",
    shapes: [group([rect([68, 12], 5), fill(accent), stroke(2, accent2, 55)])],
    position: anim([
      { t: 0, v: pos(60, -18) },
      { t: frames * 0.5, v: pos(60, -26) },
      { t: frames, v: pos(60, -18) },
    ]),
    rotation: anim([
      { t: 0, v: -2 },
      { t: frames * 0.5, v: 2 },
      { t: frames, v: -2 },
    ]),
    outPoint: frames,
  })

  const glint = shapeLayer({
    name: "glint",
    shapes: [sparkle(16, accent2)],
    position: pos(92, 30),
    scale: anim([
      { t: 0, v: scale(40, 40) },
      { t: frames * 0.5, v: scale(120, 120) },
      { t: frames, v: scale(40, 40) },
    ]),
    opacity: anim([
      { t: 0, v: 30 },
      { t: frames * 0.5, v: 100 },
      { t: frames, v: 30 },
    ]),
    outPoint: frames,
  })

  return animation({ name: "Loop empty box", frames, layers: [glint, lid, tape, box] })
}

/* ────────────────────────────────────────────────────────────────
   Lock — Pro-only items and anything held back. Held shut, with a
   pulse escaping the shackle.
   ──────────────────────────────────────────────────────────────── */

export function lockAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2, surface } = palette(input)
  const frames = seconds(2.4)

  const sway = anim([
    { t: 0, v: -3 },
    { t: frames * 0.5, v: 3 },
    { t: frames, v: -3 },
  ])

  const body = shapeLayer({
    name: "body",
    // Keyhole first: shapes earlier in the list paint over later ones.
    shapes: [
      group([ellipse(10, [0, -5]), rect([7, 15], 3, [0, 8]), fill(surface)], { position: [0, -3] }),
      group([rect([52, 40], 9), fill(accent)]),
    ],
    position: anim([
      { t: 0, v: pos(60, 66) },
      { t: frames * 0.5, v: pos(60, 62) },
      { t: frames, v: pos(60, 66) },
    ]),
    rotation: sway,
    outPoint: frames,
  })

  const shackle = shapeLayer({
    name: "shackle",
    shapes: [
      group([
        polyline([
          [-19, 0],
          [-19, -15],
          [-12, -25],
          [0, -29],
          [12, -25],
          [19, -15],
          [19, 0],
        ]),
        stroke(7, accent2),
      ]),
    ],
    position: anim([
      { t: 0, v: pos(60, 46) },
      { t: frames * 0.5, v: pos(60, 42) },
      { t: frames, v: pos(60, 46) },
    ]),
    outPoint: frames,
  })

  const pulse = shapeLayer({
    name: "pulse",
    shapes: [group([ellipse(70), stroke(2, accent2, 70)])],
    position: pos(60, 60),
    scale: anim([
      { t: 0, v: scale(60, 60) },
      { t: frames, v: scale(150, 150) },
    ]),
    opacity: anim([
      { t: 0, v: 60 },
      { t: frames, v: 0 },
    ]),
    outPoint: frames,
  })

  return animation({ name: "Loop lock", frames, layers: [body, shackle, pulse] })
}

/* ────────────────────────────────────────────────────────────────
   Gift — quests and rewards. Lid lifts, bow breathes.
   ──────────────────────────────────────────────────────────────── */

export function giftAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2, surface } = palette(input)
  const frames = seconds(3)

  const breathe = anim([
    { t: 0, v: scale(100, 100) },
    { t: frames * 0.5, v: scale(104, 104) },
    { t: frames, v: scale(100, 100) },
  ])

  const bowLeft = shapeLayer({
    name: "bow-left",
    shapes: [group([ellipse([22, 15]), fill(accent2)])],
    position: anim([
      { t: 0, v: pos(46, 26) },
      { t: frames * 0.5, v: pos(44, 22) },
      { t: frames, v: pos(46, 26) },
    ]),
    rotation: anim([
      { t: 0, v: -24 },
      { t: frames * 0.5, v: -16 },
      { t: frames, v: -24 },
    ]),
    outPoint: frames,
  })

  const bowRight = shapeLayer({
    name: "bow-right",
    shapes: [group([ellipse([22, 15]), fill(accent2)])],
    position: anim([
      { t: 0, v: pos(74, 26) },
      { t: frames * 0.5, v: pos(76, 22) },
      { t: frames, v: pos(74, 26) },
    ]),
    rotation: anim([
      { t: 0, v: 24 },
      { t: frames * 0.5, v: 16 },
      { t: frames, v: 24 },
    ]),
    outPoint: frames,
  })

  const ribbon = shapeLayer({
    name: "ribbon",
    shapes: [group([rect([11, 56], 2, [0, 4]), rect([66, 11], 2, [0, -3]), fill(accent2, 85)])],
    position: anim([
      { t: 0, v: pos(60, 66) },
      { t: frames * 0.5, v: pos(60, 62) },
      { t: frames, v: pos(60, 66) },
    ]),
    outPoint: frames,
  })

  const lid = shapeLayer({
    name: "lid",
    shapes: [group([rect([68, 13], 4), fill(accent), stroke(2, accent2, 50)])],
    position: anim([
      { t: 0, v: pos(60, 46) },
      { t: frames * 0.5, v: pos(60, 38) },
      { t: frames, v: pos(60, 46) },
    ]),
    outPoint: frames,
  })

  const box = shapeLayer({
    name: "box",
    shapes: [group([rect([58, 44], 6), fill(surface), stroke(3, accent, 85)])],
    position: anim([
      { t: 0, v: pos(60, 74) },
      { t: frames * 0.5, v: pos(60, 72) },
      { t: frames, v: pos(60, 74) },
    ]),
    scale: breathe,
    outPoint: frames,
  })

  return animation({ name: "Loop gift", frames, layers: [bowLeft, bowRight, ribbon, lid, box] })
}

/** Everything the shop can draw, keyed for convenience. */
export const LOTTIE = {
  coin: coinAnimation,
  sparkles: sparkleAnimation,
  loader: loaderAnimation,
  emptyBox: emptyBoxAnimation,
  lock: lockAnimation,
  gift: giftAnimation,
} as const

export type LottieName = keyof typeof LOTTIE

/** Rarity accent pairs, shared by the shop's cards and its animations. */
export const RARITY_PALETTE: Record<string, LottiePalette> = {
  common: { accent: "#94a3b8", accent2: "#cbd5e1", surface: "#0b0f1e" },
  rare: { accent: "#38bdf8", accent2: "#a5f3fc", surface: "#0b0f1e" },
  epic: { accent: "#a855f7", accent2: "#22d3ee", surface: "#0b0f1e" },
  legendary: { accent: "#f59e0b", accent2: "#fde68a", surface: "#0b0f1e" },
}

export function paletteForRarity(rarity?: string | null): LottiePalette {
  return RARITY_PALETTE[(rarity || "").toLowerCase()] || RARITY_PALETTE.common
}
