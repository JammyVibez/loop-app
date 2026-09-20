/**
 * A small Lottie authoring kit.
 *
 * Every animation in the app is written in code instead of downloaded, so the
 * files stay reviewable in a diff, tintable (colours are arguments, never baked
 * into the art) and free of binary assets. Only the slice of the Lottie spec
 * this app uses is implemented: shape layers, solid fills and strokes, paths,
 * and keyframed transforms.
 *
 * The output is a plain Bodymovin-shaped object, which lottie-web parses
 * exactly like a downloaded `.json`.
 */

export type LottieColor = string

/** One control axis of a bezier: numbers for scalar props, arrays for vectors. */
interface EaseAxis {
  x: number | number[]
  y: number | number[]
}

/** The two handles of a segment: out of the key it starts at, into the next. */
export interface Ease {
  o: EaseAxis
  i: EaseAxis
}

/** A keyframe's value: a number for scalars, an array for vectors. */
export type LottieValue = number | number[]

/** Anything a Lottie property can hold, static or keyframed. */
export type LottiePropValue = LottieValue | Record<string, unknown> | Array<Record<string, unknown>>

export interface Keyframe {
  /** Frame the keyframe sits on. */
  t: number
  /** Value at that frame. */
  v: LottieValue
  /** Easing of the segment that *starts* here. Defaults to linear. */
  ease?: Ease
}

export interface LottieProp {
  a: 0 | 1
  k: LottiePropValue
}

export const EASE: Record<"linear" | "smooth" | "out" | "in", Ease> = {
  /** Symmetric handles: a straight line, i.e. constant speed. */
  linear: { o: { x: 0.5, y: 0.5 }, i: { x: 0.5, y: 0.5 } },
  /** After Effects' default — slow in, slow out. */
  smooth: { o: { x: 0.333, y: 0 }, i: { x: 0.667, y: 1 } },
  /** Fast out of the gate, settles at the end. Good for entrances. */
  out: { o: { x: 0.16, y: 0 }, i: { x: 0.3, y: 1 } },
  /** Slow start, quick finish. Good for exits. */
  in: { o: { x: 0.7, y: 0 }, i: { x: 0.84, y: 1 } },
}

/** A static value. */
export function val(k: LottieValue): LottieProp {
  return { a: 0, k }
}

/** A keyframed value. */
export function anim(keys: Keyframe[]): LottieProp {
  if (keys.length === 0) throw new Error("anim() needs at least one keyframe")

  const k = keys.map((key, index) => {
    const values = typeof key.v === "number" ? [key.v] : key.v
    const frame: Record<string, unknown> = { t: key.t, s: values }

    // Tangents belong to the keyframe a segment starts from; the last keyframe
    // has no segment of its own to ease.
    if (index < keys.length - 1) {
      const ease = key.ease ?? EASE.linear
      const dims = values.length
      frame.o = { x: spread(ease.o.x, dims), y: spread(ease.o.y, dims) }
      frame.i = { x: spread(ease.i.x, dims), y: spread(ease.i.y, dims) }
    }
    return frame
  })

  return { a: 1, k }
}

/**
 * Tangents are scalars for scalar properties and vectors for vector ones, so
 * one handle has to be widened to match the value it eases.
 */
function spread(axis: number | number[], dims: number): number | number[] {
  if (typeof axis !== "number") return axis
  return dims === 1 ? axis : new Array(dims).fill(axis)
}

/** `#rrggbb` (or `#rgb`) into Lottie's 0–1 float quadruple. */
export function toLottieColor(hex: string, alpha = 1): number[] {
  const clean = hex.replace("#", "").trim()
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean
  const int = Number.parseInt(full.slice(0, 6) || "ffffff", 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255
  const a = alpha * (full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1)
  return [round(r), round(g), round(b), round(a)]
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Shared group transform. Every shape group must end with one of these. */
function groupTransform({
  position = [0, 0],
  anchor = [0, 0],
  scale,
  rotation,
  opacity,
}: {
  position?: number[] | LottieProp
  anchor?: number[]
  scale?: number[] | LottieProp
  rotation?: number | LottieProp
  opacity?: number | LottieProp
} = {}) {
  return {
    ty: "tr",
    nm: "Transform",
    p: isProp(position) ? position : val(position),
    a: val(anchor),
    s: isProp(scale) ? scale : val(scale ?? [100, 100]),
    r: isProp(rotation) ? rotation : val(rotation ?? 0),
    o: isProp(opacity) ? opacity : val(opacity ?? 100),
    sk: val(0),
    sa: val(0),
  }
}

function isProp(value: unknown): value is LottieProp {
  return typeof value === "object" && value !== null && "k" in (value as Record<string, unknown>)
}

export type ShapeItem = Record<string, unknown>

/** An ellipse of `size` [w, h] centred on `position` inside its group. */
export function ellipse(size: [number, number] | number, position: [number, number] = [0, 0]): ShapeItem {
  const s: [number, number] = typeof size === "number" ? [size, size] : size
  return { ty: "el", nm: "Ellipse", d: 1, p: val(position), s: val(s) }
}

/** A rounded rectangle. */
export function rect(
  size: [number, number],
  radius = 0,
  position: [number, number] = [0, 0],
): ShapeItem {
  return { ty: "rc", nm: "Rect", d: 1, p: val(position), s: val(size), r: val(radius) }
}

/**
 * A polygon from absolute points.
 *
 * Vertices are a flat `[x, y, x, y, …]` list, but the bezier tangents beside
 * them are *pairs*, one per vertex, and are relative to the vertex they belong
 * to. Straight edges therefore mean a pair of zeros, not a flat run of them.
 */
export function polygon(points: Array<[number, number]>, closed = true): ShapeItem {
  const verts = points.flat()
  const tangent = () => points.map(() => [0, 0])
  return {
    ty: "sh",
    nm: "Polygon",
    d: 1,
    ks: { a: 0, k: { i: tangent(), o: tangent(), v: verts, c: closed } },
  }
}

/** A stroked polyline — used for shapes a rect/ellipse cannot express. */
export function polyline(points: Array<[number, number]>): ShapeItem {
  return polygon(points, false)
}

export function fill(color: LottieColor, opacity = 100): ShapeItem {
  return { ty: "fl", nm: "Fill", c: val(toLottieColor(color)), o: val(opacity), r: 1 }
}

export function stroke(width: number, color: LottieColor, opacity = 100): ShapeItem {
  return {
    ty: "st",
    nm: "Stroke",
    c: val(toLottieColor(color)),
    o: val(opacity),
    w: val(width),
    lc: 2,
    lj: 2,
    ml: 4,
  }
}

/** A shape group: its shapes, then the transform they share. */
export function group(
  items: ShapeItem[],
  transform: Parameters<typeof groupTransform>[0] = {},
): ShapeItem {
  return { ty: "gr", nm: "Group", it: [...items, groupTransform(transform)] }
}

export interface LayerOptions {
  name: string
  shapes: ShapeItem[]
  position?: number[] | LottieProp
  anchor?: number[]
  scale?: number[] | LottieProp
  rotation?: number | LottieProp
  opacity?: number | LottieProp
  /** Frame the layer appears on. */
  inPoint?: number
  /** Frame the layer disappears on. */
  outPoint: number
}

/** A shape layer. `ind` is assigned by `animation()` from the array order. */
export function shapeLayer(options: LayerOptions) {
  const {
    name,
    shapes,
    position = [0, 0],
    anchor = [0, 0],
    scale,
    rotation,
    opacity,
    inPoint = 0,
    outPoint,
  } = options

  return {
    ddd: 0,
    ty: 4,
    nm: name,
    sr: 1,
    ao: 0,
    ks: {
      o: isProp(opacity) ? opacity : val(opacity ?? 100),
      r: isProp(rotation) ? rotation : val(rotation ?? 0),
      p: isProp(position) ? position : val(position),
      a: val(anchor),
      s: isProp(scale) ? scale : val(scale ?? [100, 100]),
    },
    shapes,
    ip: inPoint,
    op: outPoint,
    st: 0,
    bm: 0,
  }
}

export interface AnimationOptions {
  name: string
  width?: number
  height?: number
  frameRate?: number
  /** Total length in frames. */
  frames: number
  /**
   * Layers, top first — index 0 paints over index 1, as in a Bodymovin export.
   * `ind` is derived from the position, so the order here is the whole story.
   */
  layers: ReturnType<typeof shapeLayer>[]
}

/**
 * An animation, ready to hand to `<Lottie src={...} />`.
 *
 * Frames and seconds are the same thing at `frameRate`; both are derived here
 * so an animation can be authored by duration and stay readable.
 */
export function animation({ name, width = 120, height = 120, frameRate = 60, frames, layers }: AnimationOptions) {
  return {
    v: "5.13.0",
    fr: frameRate,
    ip: 0,
    op: frames,
    w: width,
    h: height,
    nm: name,
    ddd: 0,
    assets: [],
    layers: layers.map((layer, index) => ({ ...layer, ind: index + 1 })),
  }
}

/** Seconds → frames, at the kit's 60fps. */
export function seconds(value: number, frameRate = 60): number {
  return Math.round(value * frameRate)
}
