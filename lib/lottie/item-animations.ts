/**
 * Item-specific Lottie animations for the shop.
 *
 * Each factory returns a Bodymovin-shaped object keyed to a keyword that
 * appears in shop item names.  The keyword → animation lookup is in
 * `components/shop/shop-art.ts`.
 */

import { EASE, anim, animation, ellipse, fill, group, polygon, polyline, rect, seconds, shapeLayer, stroke, type LottieProp, type ShapeItem } from "./build"
import { type LottiePalette, DEFAULT_PALETTE } from "./animations"

function pos(x: number, y: number) { return [x, y, 0] }
function scale(x: number, y: number) { return [x, y, 100] }
function palette(input: Partial<LottiePalette> = {}): LottiePalette { return { ...DEFAULT_PALETTE, ...input } }

/* ── Crown ────────────────────────────────────────────────────────────── */

export function crownAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2, surface } = palette(input)
  const frames = seconds(2.5)

  const gem = (x: number, y: number, size: number, color: string): ShapeItem =>
    group([
      polygon([[0, -size], [size * 0.6, 0], [0, size], [-size * 0.6, 0]]),
      fill(color),
    ])

  const crown: ShapeItem = group([
    // Base band
    group([rect([70, 12], 3, [0, 10]), fill(accent)]),
    // Three points
    polygon([[-30, -16], [-20, -36], [-10, -16]]),
    polygon([[-5, -22], [0, -42], [5, -22]]),
    polygon([[10, -16], [20, -36], [30, -16]]),
    fill(accent),
    // Gems on tips
    gem(-20, -36, 4, accent2),
    gem(0, -42, 5, accent2),
    gem(20, -36, 4, accent2),
  ])

  const sparkle1 = group([gem(0, 0, 6, accent2)])
  const sparkle2 = group([gem(0, 0, 4, accent)])
  const sparkle3 = group([gem(0, 0, 5, accent2)])

  const sp1 = shapeLayer({
    name: "sparkle-1",
    shapes: [sparkle1],
    position: pos(60, 22),
    scale: anim([
      { t: 0, v: scale(0, 0) },
      { t: frames * 0.3, v: scale(120, 120) },
      { t: frames * 0.6, v: scale(0, 0) },
      { t: frames, v: scale(0, 0) },
    ]),
    opacity: anim([
      { t: 0, v: 0 },
      { t: frames * 0.3, v: 100 },
      { t: frames * 0.6, v: 0 },
      { t: frames, v: 0 },
    ]),
    outPoint: frames,
  })
  const sp2 = shapeLayer({
    name: "sparkle-2",
    shapes: [sparkle2],
    position: pos(88, 40),
    scale: anim([
      { t: frames * 0.2, v: scale(0, 0) },
      { t: frames * 0.5, v: scale(110, 110) },
      { t: frames * 0.8, v: scale(0, 0) },
    ]),
    opacity: anim([
      { t: frames * 0.2, v: 0 },
      { t: frames * 0.5, v: 90 },
      { t: frames * 0.8, v: 0 },
    ]),
    outPoint: frames,
  })
  const sp3 = shapeLayer({
    name: "sparkle-3",
    shapes: [sparkle3],
    position: pos(34, 42),
    scale: anim([
      { t: frames * 0.35, v: scale(0, 0) },
      { t: frames * 0.65, v: scale(115, 115) },
      { t: frames * 0.95, v: scale(0, 0) },
    ]),
    opacity: anim([
      { t: frames * 0.35, v: 0 },
      { t: frames * 0.65, v: 95 },
      { t: frames * 0.95, v: 0 },
    ]),
    outPoint: frames,
  })

  const crownLayer = shapeLayer({
    name: "crown",
    shapes: [crown],
    position: pos(60, 62),
    scale: anim([
      { t: 0, v: scale(100, 100) },
      { t: frames * 0.5, v: scale(106, 106) },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  return animation({ name: "Crown", frames, layers: [sp3, sp2, sp1, crownLayer] })
}

/* ── Heart ────────────────────────────────────────────────────────────── */

export function heartAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(2)

  const heart: ShapeItem = group([
    // Two circles for the top bumps. Each is its own group, so each carries its
    // own fill — without one they were drawing nothing at all.
    group([ellipse(18, [-10, -8]), fill(accent)]),
    group([ellipse(18, [10, -8]), fill(accent)]),
    // Triangle for the bottom
    polygon([[-28, -4], [0, 28], [28, -4]]),
    fill(accent),
  ])

  const heartLayer = shapeLayer({
    name: "heart",
    shapes: [heart],
    position: pos(60, 58),
    scale: anim([
      { t: 0, v: scale(100, 100) },
      { t: frames * 0.15, v: scale(115, 115) },
      { t: frames * 0.3, v: scale(100, 100) },
      { t: frames * 0.45, v: scale(110, 110) },
      { t: frames * 0.6, v: scale(100, 100) },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  // Floating mini hearts
  const miniHearts = [0, 1, 2].map((i) => {
    const x = 35 + i * 25
    const delay = i * 12
    return shapeLayer({
      name: `mini-${i}`,
      shapes: [group([polygon([[-6, -3], [0, 6], [6, -3]]), fill(i === 1 ? accent2 : accent, 70)])],
      position: anim([
        { t: 0, v: pos(x, 80) },
        { t: delay, v: pos(x, 80) },
        { t: frames, v: [x, 20, 0] },
      ]),
      scale: anim([
        { t: 0, v: scale(0, 0) },
        { t: delay, v: scale(0, 0) },
        { t: delay + 10, v: scale(100, 100) },
        { t: frames, v: scale(40, 40) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 10, v: 80 },
        { t: frames, v: 0 },
      ]),
      outPoint: frames,
    })
  })

  return animation({ name: "Heart", frames, layers: [...miniHearts, heartLayer] })
}

/* ── Star ─────────────────────────────────────────────────────────────── */

export function starAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(2.4)

  const star5 = (size: number): ShapeItem => {
    const tip = size
    const inner = size * 0.38
    const pts: Array<[number, number]> = []
    for (let i = 0; i < 5; i++) {
      const tipAngle = (i * 72 - 90) * (Math.PI / 180)
      const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180)
      pts.push([Math.cos(tipAngle) * tip, Math.sin(tipAngle) * tip])
      pts.push([Math.cos(innerAngle) * inner, Math.sin(innerAngle) * inner])
    }
    return group([polygon(pts), fill(accent)])
  }

  const core = shapeLayer({
    name: "star",
    shapes: [star5(30), group([star5(14), fill(accent2)])],
    position: pos(60, 58),
    rotation: anim([
      { t: 0, v: -8 },
      { t: frames * 0.5, v: 8 },
      { t: frames, v: -8 },
    ]),
    scale: anim([
      { t: 0, v: scale(100, 100) },
      { t: frames * 0.5, v: scale(112, 112) },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  // Orbiting smaller stars
  const orbit = (delay: number, distance: number, size: number, color: string) =>
    shapeLayer({
      name: `orbit-${delay}`,
      shapes: [star5(size)],
      position: anim([
        { t: 0, v: [60 + distance, 58, 0] },
        { t: frames, v: [60 + distance * Math.cos(Math.PI * 2) - distance, 58, 0] },
      ]),
      rotation: anim([{ t: 0, v: 0 }, { t: frames, v: 360 }]),
      scale: anim([
        { t: 0, v: scale(0, 0) },
        { t: delay, v: scale(0, 0) },
        { t: delay + 15, v: scale(100, 100) },
        { t: frames, v: scale(60, 60) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 10, v: 80 },
        { t: frames, v: 40 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Star",
    frames,
    layers: [orbit(0, 35, 10, accent2), orbit(10, 32, 8, accent), core],
  })
}

/* ── Diamond / Gem ────────────────────────────────────────────────────── */

export function diamondAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(2.5)

  const gem: ShapeItem = group([
    // Top facet (wide rectangle)
    group([polygon([[-22, -4], [22, -4], [28, 4], [-28, 4]]), fill(accent, 90)]),
    // Bottom point
    group([polygon([[-28, 4], [28, 4], [0, 30]]), fill(accent2, 80)]),
    // Top cap
    group([polygon([[-14, -20], [14, -20], [22, -4], [-22, -4]]), fill(accent)]),
    // Inner facet lines
    group([polyline([[-22, -4], [0, 8], [22, -4]]), stroke(1.5, "#FFFFFF", 30)]),
    group([polyline([[0, -20], [0, 30]]), stroke(1, "#FFFFFF", 20)]),
  ])

  const gemLayer = shapeLayer({
    name: "gem",
    shapes: [gem],
    position: pos(60, 56),
    scale: anim([
      { t: 0, v: scale(100, 100) },
      { t: frames * 0.5, v: scale(108, 108) },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  // Light refraction glints
  const glint = (x: number, y: number, delay: number) =>
    shapeLayer({
      name: `glint-${x}`,
      shapes: [group([polygon([[0, -8], [3, 0], [0, 8], [-3, 0]]), fill("#FFFFFF", 90)])],
      position: pos(x, y),
      scale: anim([
        { t: 0, v: scale(0, 0) },
        { t: delay, v: scale(0, 0) },
        { t: delay + 8, v: scale(100, 100) },
        { t: delay + 18, v: scale(0, 0) },
        { t: frames, v: scale(0, 0) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 6, v: 100 },
        { t: delay + 16, v: 0 },
        { t: frames, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Diamond",
    frames,
    layers: [glint(42, 34, 0), glint(78, 30, frames * 0.35), glint(56, 48, frames * 0.6), gemLayer],
  })
}

/* ── Lightning bolt ───────────────────────────────────────────────────── */

export function lightningAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(1.8)

  const bolt: ShapeItem = group([
    polygon([[-6, -28], [10, -4], [2, -4], [8, 28], [-10, 0], [-2, 0]]),
    fill(accent),
  ])

  const boltLayer = shapeLayer({
    name: "bolt",
    shapes: [bolt],
    position: pos(60, 60),
    scale: anim([
      { t: 0, v: scale(80, 80) },
      { t: frames * 0.12, v: scale(120, 120) },
      { t: frames * 0.25, v: scale(100, 100) },
      { t: frames * 0.35, v: scale(110, 110) },
      { t: frames * 0.5, v: scale(100, 100) },
      { t: frames, v: scale(80, 80) },
    ]),
    outPoint: frames,
  })

  // Flash ring
  const flash = shapeLayer({
    name: "flash",
    shapes: [group([ellipse(80), stroke(3, accent2, 60)])],
    position: pos(60, 60),
    scale: anim([
      { t: 0, v: scale(30, 30) },
      { t: frames * 0.15, v: scale(140, 140) },
    ]),
    opacity: anim([
      { t: 0, v: 80 },
      { t: frames * 0.15, v: 0 },
    ]),
    outPoint: frames,
  })

  // Sparks
  const spark = (x: number, y: number, delay: number) =>
    shapeLayer({
      name: `spark-${x}`,
      shapes: [group([ellipse(4), fill(accent2)])],
      position: anim([
        { t: 0, v: pos(60, 60) },
        { t: delay, v: pos(60, 60) },
        { t: delay + 6, v: pos(x, y) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 3, v: 100 },
        { t: delay + 10, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Lightning",
    frames,
    layers: [flash, spark(30, 30, 2), spark(88, 36, 4), spark(40, 90, 6), spark(80, 86, 8), boltLayer],
  })
}

/* ── Music note ───────────────────────────────────────────────────────── */

export function musicAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(2.5)

  const note1: ShapeItem = group([
    // The head is its own group so it can sit off the stem, which means it
    // needs its own fill: a parent's fill never reaches into a nested group.
    group([ellipse(10, [-2, 12]), fill(accent)]),
    group([rect([3, -28], 2, [10, -14]), fill(accent)]),
    // Flag
    group([polyline([[13, -28], [24, -22], [13, -18]]), fill(accent)]),
    fill(accent),
  ])

  const note2: ShapeItem = group([
    group([ellipse(8, [-1, 10]), fill(accent2)]),
    group([rect([3, -22], 2, [8, -11]), fill(accent2)]),
    group([polyline([[11, -22], [20, -17], [11, -13]]), fill(accent2)]),
    fill(accent2),
  ])

  const n1 = shapeLayer({
    name: "note-1",
    shapes: [note1],
    position: anim([
      { t: 0, v: pos(46, 56) },
      { t: frames * 0.5, v: pos(46, 48) },
      { t: frames, v: pos(46, 56) },
    ]),
    rotation: anim([
      { t: 0, v: -5 },
      { t: frames * 0.5, v: 5 },
      { t: frames, v: -5 },
    ]),
    outPoint: frames,
  })

  const n2 = shapeLayer({
    name: "note-2",
    shapes: [note2],
    position: anim([
      { t: frames * 0.2, v: pos(72, 60) },
      { t: frames * 0.7, v: pos(72, 50) },
      { t: frames, v: pos(72, 60) },
    ]),
    rotation: anim([
      { t: frames * 0.2, v: 5 },
      { t: frames * 0.7, v: -5 },
      { t: frames, v: 5 },
    ]),
    outPoint: frames,
  })

  // Sound waves
  const wave = (delay: number, distance: number) =>
    shapeLayer({
      name: `wave-${delay}`,
      shapes: [group([ellipse([20, 60]), stroke(2, accent2, 50)])],
      position: pos(60, 58),
      scale: anim([
        { t: 0, v: scale(0, 0) },
        { t: delay, v: scale(0, 0) },
        { t: delay + 10, v: scale(distance, distance) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 6, v: 60 },
        { t: delay + 14, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Music",
    frames,
    layers: [wave(0, 80), wave(14, 100), n2, n1],
  })
}

/* ── Rocket / Speed ───────────────────────────────────────────────────── */

export function rocketAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(2)

  const body: ShapeItem = group([
    // Nose cone
    group([polygon([[0, -30], [8, -12], [-8, -12]]), fill(accent)]),
    // Body
    group([rect([16, 30], 4, [0, 3]), fill(accent)]),
    // Window
    group([ellipse(5, [0, -8]), fill(accent2)]),
    // Fins
    group([polygon([[-8, 10], [-16, 20], [-8, 18]]), fill(accent2, 80)]),
    group([polygon([[8, 10], [16, 20], [8, 18]]), fill(accent2, 80)]),
  ])

  const flame: ShapeItem = group([
    group([polygon([[-6, 16], [0, 32], [6, 16]]), fill(accent2)]),
    group([polygon([[-3, 16], [0, 26], [3, 16]]), fill(accent, 80)]),
  ])

  const rocketLayer = shapeLayer({
    name: "rocket",
    shapes: [body],
    position: anim([
      { t: 0, v: pos(60, 62) },
      { t: frames * 0.5, v: pos(60, 54) },
      { t: frames, v: pos(60, 62) },
    ]),
    outPoint: frames,
  })

  const flameLayer = shapeLayer({
    name: "flame",
    shapes: [flame],
    position: anim([
      { t: 0, v: pos(60, 62) },
      { t: frames * 0.5, v: pos(60, 54) },
      { t: frames, v: pos(60, 62) },
    ]),
    scale: anim([
      { t: 0, v: scale(100, 100) },
      { t: frames * 0.15, v: scale(120, 130) },
      { t: frames * 0.3, v: scale(90, 110) },
      { t: frames * 0.5, v: scale(115, 125) },
      { t: frames * 0.7, v: scale(95, 115) },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  // Trail sparks
  const spark = (x: number, delay: number) =>
    shapeLayer({
      name: `trail-${x}`,
      shapes: [group([ellipse(3), fill(accent2, 70)])],
      position: anim([
        { t: 0, v: pos(60, 80) },
        { t: delay, v: pos(60, 80) },
        { t: delay + 8, v: pos(x, 100) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 3, v: 80 },
        { t: delay + 10, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Rocket",
    frames,
    layers: [spark(50, 0), spark(68, 4), spark(55, 8), flameLayer, rocketLayer],
  })
}

/* ── Flame ────────────────────────────────────────────────────────────── */

export function flameAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2, surface } = palette(input)
  const frames = seconds(2)

  const flame: ShapeItem = group([
    group([
      polygon([[-14, 20], [0, -30], [14, 20]]),
      fill(accent),
    ]),
    group([
      polygon([[-8, 18], [0, -18], [8, 18]]),
      fill(accent2),
    ]),
    group([
      polygon([[-4, 14], [0, -8], [4, 14]]),
      fill(surface, 60),
    ]),
  ])

  const flameLayer = shapeLayer({
    name: "flame",
    shapes: [flame],
    position: pos(60, 58),
    scale: anim([
      { t: 0, v: scale(100, 100) },
      { t: frames * 0.25, v: scale(108, 112) },
      { t: frames * 0.5, v: scale(96, 104) },
      { t: frames * 0.75, v: scale(110, 108) },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  // Rising embers
  const ember = (x: number, delay: number) =>
    shapeLayer({
      name: `ember-${x}`,
      shapes: [group([ellipse(3), fill(accent2, 80)])],
      position: anim([
        { t: 0, v: pos(x, 70) },
        { t: delay, v: pos(x, 70) },
        { t: frames, v: [x, 16, 0] },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 4, v: 90 },
        { t: frames, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Flame",
    frames,
    layers: [ember(44, 0), ember(60, 6), ember(76, 12), flameLayer],
  })
}

/* ── Shield ───────────────────────────────────────────────────────────── */

export function shieldAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2, surface } = palette(input)
  const frames = seconds(2.5)

  const shield: ShapeItem = group([
    group([
      polygon([[-26, -24], [26, -24], [26, 4], [0, 28], [-26, 4]]),
      fill(surface),
      stroke(3, accent),
    ]),
    // Check mark inside
    group([
      polyline([[-10, 0], [-3, 10], [12, -10]]),
      stroke(5, accent2),
    ]),
  ])

  const shieldLayer = shapeLayer({
    name: "shield",
    shapes: [shield],
    position: pos(60, 58),
    scale: anim([
      { t: 0, v: scale(100, 100) },
      { t: frames * 0.5, v: scale(105, 105) },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  // Pulse rings
  const pulse = (delay: number) =>
    shapeLayer({
      name: `pulse-${delay}`,
      shapes: [group([polygon([[-26, -24], [26, -24], [26, 4], [0, 28], [-26, 4]]), stroke(2, accent2, 50)])],
      position: pos(60, 58),
      scale: anim([
        { t: 0, v: scale(80, 80) },
        { t: delay, v: scale(80, 80) },
        { t: delay + 20, v: scale(140, 140) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 6, v: 60 },
        { t: delay + 22, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Shield",
    frames,
    layers: [pulse(0), pulse(frames * 0.5), shieldLayer],
  })
}

/* ── Wand / Magic ─────────────────────────────────────────────────────── */

export function wandAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(2.5)

  const wand: ShapeItem = group([
    // Stick
    group([rect([4, 42], 2, [0, 8]), fill(accent)]),
    // Star tip
    (() => {
      const tip = 10
      const inner = 4
      const pts: Array<[number, number]> = []
      for (let i = 0; i < 5; i++) {
        const tipAngle = (i * 72 - 90) * (Math.PI / 180)
        const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180)
        pts.push([Math.cos(tipAngle) * tip, Math.sin(tipAngle) * tip])
        pts.push([Math.cos(innerAngle) * inner, Math.sin(innerAngle) * inner])
      }
      return group([polygon(pts), fill(accent2)])
    })(),
  ])

  const wandLayer = shapeLayer({
    name: "wand",
    shapes: [wand],
    position: pos(60, 56),
    rotation: anim([
      { t: 0, v: -10 },
      { t: frames * 0.5, v: 10 },
      { t: frames, v: -10 },
    ]),
    outPoint: frames,
  })

  // Sparkle burst from tip
  const burst = (x: number, y: number, delay: number, size: number) =>
    shapeLayer({
      name: `burst-${x}`,
      shapes: [group([polygon([[0, -size], [size * 0.3, 0], [0, size], [-size * 0.3, 0]]), fill(accent2)])],
      position: anim([
        { t: 0, v: pos(60, 32) },
        { t: delay, v: pos(60, 32) },
        { t: delay + 8, v: pos(x, y) },
      ]),
      scale: anim([
        { t: 0, v: scale(0, 0) },
        { t: delay, v: scale(0, 0) },
        { t: delay + 5, v: scale(100, 100) },
        { t: delay + 14, v: scale(0, 0) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 3, v: 100 },
        { t: delay + 12, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Wand",
    frames,
    layers: [
      burst(36, 26, 0, 7),
      burst(80, 22, 6, 5),
      burst(48, 14, 12, 6),
      burst(72, 34, 18, 5),
      wandLayer,
    ],
  })
}

/* ── Car / Vehicle ────────────────────────────────────────────────────── */

export function carAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2, surface } = palette(input)
  const frames = seconds(2.5)

  // Simple side-view car
  const car: ShapeItem = group([
    // Body
    group([rect([52, 16], 6, [0, 6]), fill(accent)]),
    // Roof
    group([rect([26, 12], 5, [-4, -6]), fill(accent)]),
    // Windshield
    group([
      polygon([[-16, -6], [-8, -6], [-6, 2], [-16, 2]]),
      fill(accent2, 60),
    ]),
    // Rear window
    group([
      polygon([[6, -6], [12, -6], [14, 2], [6, 2]]),
      fill(accent2, 50),
    ]),
    // Wheels
    group([ellipse(7, [-16, 14]), fill(surface), stroke(2, accent2)]),
    group([ellipse(7, [16, 14]), fill(surface), stroke(2, accent2)]),
    // Wheel centers
    group([ellipse(2.5, [-16, 14]), fill(accent2)]),
    group([ellipse(2.5, [16, 14]), fill(accent2)]),
  ])

  const carLayer = shapeLayer({
    name: "car",
    shapes: [car],
    position: anim([
      { t: 0, v: pos(52, 56) },
      { t: frames * 0.5, v: pos(68, 56) },
      { t: frames, v: pos(52, 56) },
    ]),
    scale: anim([
      { t: 0, v: scale(100, 100) },
      { t: frames * 0.5, v: scale(104, 104) },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  // Speed lines
  const line = (y: number, delay: number, w: number) =>
    shapeLayer({
      name: `line-${y}`,
      shapes: [group([rect([w, 2], 1), fill(accent2, 40)])],
      position: anim([
        { t: 0, v: pos(20, y) },
        { t: delay, v: pos(20, y) },
        { t: delay + 6, v: pos(-10, y) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 2, v: 70 },
        { t: delay + 8, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Car",
    frames,
    layers: [line(50, 0, 24), line(56, 3, 30), line(62, 6, 20), line(66, 9, 26), carLayer],
  })
}

/* ── Rose / Garden ──────────────────────────────────────────────────────
 *
 * A rose in bloom on its stem: three rings of petals opening in sequence,
 * leaves unfurling along the stem, and a few petals drifting loose.
 *
 * The bloom is tinted from the rarity palette like every other animation;
 * the stem and leaves keep a botanical green, because a violet stem reads as
 * a mistake rather than a rose.
 */

const STEM = "#3fae72"
const LEAF = "#2f8f5c"

export function roseAnimation(input: Partial<LottiePalette> = {}) {
  const { accent, accent2 } = palette(input)
  const frames = seconds(3)

  /**
   * One petal of a ring: an upright oval pinned `radius` out from the centre.
   * It is rotated by its own group, so it must be filled by its own group too.
   */
  const petal = (size: [number, number], radius: number, angle: number, color: string, opacity: number): ShapeItem =>
    group([ellipse(size, [0, -radius]), fill(color, opacity)], { rotation: angle })

  /**
   * A ring of petals that spirals shut as it unfurls — the slow counter-roll
   * is what makes it read as a flower opening rather than a shape scaling up.
   */
  const bloom = (
    count: number,
    radius: number,
    size: [number, number],
    color: string,
    delay: number,
    spin: number,
    opacity = 100,
  ) =>
    shapeLayer({
      name: `petals-${count}`,
      shapes: [group(Array.from({ length: count }, (_, i) => petal(size, radius, (360 / count) * i, color, opacity)))],
      position: pos(60, 46),
      rotation: anim([
        { t: 0, v: spin },
        { t: delay, v: spin },
        { t: delay + 24, v: 0, ease: EASE.out },
        { t: frames, v: 0 },
      ]),
      scale: anim([
        { t: 0, v: scale(0, 0) },
        { t: delay, v: scale(0, 0) },
        { t: delay + 16, v: scale(112, 112) },
        { t: delay + 26, v: scale(100, 100) },
        { t: frames, v: scale(100, 100) },
      ]),
      outPoint: frames,
    })

  // Stem and leaves, anchored at the top of the stem so it grows downwards.
  const plant = shapeLayer({
    name: "stem",
    shapes: [
      group([
        group([rect([5, 42], 2), fill(STEM)]),
        group([ellipse([28, 13], [15, -7]), fill(LEAF)], { rotation: -26 }),
        group([ellipse([28, 13], [-15, 7]), fill(LEAF)], { rotation: 26 }),
      ]),
    ],
    anchor: [0, -21],
    position: pos(60, 64),
    scale: anim([
      { t: 0, v: scale(100, 0) },
      { t: 8, v: scale(100, 0) },
      { t: 30, v: scale(100, 100), ease: EASE.out },
      { t: frames, v: scale(100, 100) },
    ]),
    outPoint: frames,
  })

  // Petals knocked loose, drifting down past the stem.
  const drift = (x: number, delay: number, tilt: number) =>
    shapeLayer({
      name: `drift-${x}`,
      shapes: [group([ellipse([9, 13]), fill(accent2, 85)])],
      position: anim([
        { t: 0, v: pos(x, 58) },
        { t: delay, v: pos(x, 58) },
        { t: frames, v: [x + tilt, 112, 0] },
      ]),
      rotation: anim([
        { t: 0, v: 0 },
        { t: frames, v: 150 },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 8, v: 85 },
        { t: frames - 10, v: 50 },
        { t: frames, v: 0 },
      ]),
      outPoint: frames,
    })

  /** A four-point glint, sized in half-extents. */
  const glint = (size: number, color: string) =>
    group([polygon([[0, -size], [size * 0.34, 0], [0, size], [-size * 0.34, 0]]), fill(color)])

  const spark = (x: number, y: number, delay: number, size: number, color: string) =>
    shapeLayer({
      name: `glint-${x}-${y}`,
      shapes: [glint(size, color)],
      position: pos(x, y),
      scale: anim([
        { t: 0, v: scale(0, 0) },
        { t: delay, v: scale(0, 0) },
        { t: delay + 8, v: scale(118, 118), ease: EASE.out },
        { t: delay + 24, v: scale(0, 0) },
      ]),
      opacity: anim([
        { t: 0, v: 0 },
        { t: delay, v: 0 },
        { t: delay + 8, v: 95 },
        { t: delay + 24, v: 0 },
      ]),
      outPoint: frames,
    })

  return animation({
    name: "Rose",
    frames,
    layers: [
      spark(96, 30, 26, 8, accent2),
      spark(26, 40, 34, 6, accent),
      drift(40, 40, -12),
      drift(78, 54, 14),
      drift(60, 68, -6),
      bloom(4, 7, [13, 17], accent, 22, 46),
      bloom(6, 13, [14, 20], accent2, 11, -34, 92),
      bloom(8, 19, [15, 24], accent, 0, 28),
      plant,
    ],
  })
}

/** Every item illustration, keyed by name — the tested set. */
export const ITEM_LOTTIE = {
  car: carAnimation,
  rose: roseAnimation,
  crown: crownAnimation,
  diamond: diamondAnimation,
  flame: flameAnimation,
  heart: heartAnimation,
  lightning: lightningAnimation,
  music: musicAnimation,
  rocket: rocketAnimation,
  shield: shieldAnimation,
  star: starAnimation,
  wand: wandAnimation,
} as const

export type ItemLottieName = keyof typeof ITEM_LOTTIE
