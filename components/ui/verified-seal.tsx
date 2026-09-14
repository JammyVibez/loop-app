"use client"

import { useEffect, useId, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * VerifiedSeal — the app's verified checkmark, designed as an award seal:
 *  - scalloped "seal" silhouette with an inner ring and dome highlight
 *  - theme-matched colors: read the app's background so the seal always has
 *    contrast in BOTH light and dark mode (a white-glow on white bg is why the
 *    old version "disappeared" in light theme)
 *  - variants are differentiated by SHAPE as well as color, so they're
 *    distinguishable even for color-blind users or at tiny sizes:
 *      verified  → scalloped rosette seal (classic checkmark seal)
 *      team      → hexagon badge
 *      emerald   → shield badge (orgs / root-verified)
 *      gold      → star badge (sponsors)
 *  - the checkmark draws itself in on first appearance
 *
 * Colors follow the theme: dark theme uses the vivid brand gradient; light
 * theme deepens the gradient so the badge doesn't wash out against white.
 */

export type SealVariant = "verified" | "gold" | "emerald" | "team"

export interface VerifiedSealProps {
  /** Tooltip label, e.g. "Verified Creator" */
  title?: string
  /** Visual variant — controls badge shape + color */
  variant?: SealVariant
  /** Custom gradient/solid colors (overrides variant). 1 = solid, 2 = gradient */
  colors?: string[]
  /** Size in px (default 20). Common sizes: 14, 16, 18, 20, 24 */
  size?: number
  /** Extra classes on the wrapper */
  className?: string
  /** Disable the draw-on + shimmer animation (e.g. dense lists, print) */
  static?: boolean
}

interface VariantSpec {
  /** Dark-theme gradient stops */
  darkFrom: string
  darkTo: string
  /** Light-theme gradient stops (deepened for contrast on white) */
  lightFrom: string
  lightTo: string
  /** Solid fill for light theme single-color case */
  lightSolid: string
  /** Checkmark color */
  check: string
  /** Ring color that separates the badge from the background */
  ring: string
}

const VARIANTS: Record<SealVariant, VariantSpec> = {
  verified: {
    // Dark theme: cyan → violet, BOTH stops bright so the badge stays vivid at
    // small sizes on dark cards (a dark indigo stop read as a "dark" blob).
    darkFrom: "#22d3ee", darkTo: "#818cf8",
    lightFrom: "#0284c7", lightTo: "#4f46e5",
    lightSolid: "#0ea5e9",
    check: "#ffffff",
    ring: "rgba(255,255,255,0.85)",
  },
  team: {
    darkFrom: "#818cf8", darkTo: "#c084fc",
    lightFrom: "#4f46e5", lightTo: "#9333ea",
    lightSolid: "#7c3aed",
    check: "#ffffff",
    ring: "rgba(255,255,255,0.85)",
  },
  emerald: {
    darkFrom: "#34d399", darkTo: "#14b8a6",
    lightFrom: "#059669", lightTo: "#0d9488",
    lightSolid: "#10b981",
    check: "#ffffff",
    ring: "rgba(255,255,255,0.85)",
  },
  gold: {
    darkFrom: "#fbbf24", darkTo: "#f97316",
    lightFrom: "#d97706", lightTo: "#ea580c",
    lightSolid: "#f59e0b",
    check: "#ffffff",
    ring: "rgba(255,255,255,0.9)",
  },
}

/** Detect theme once per seal render — the app toggles `dark` on <html>. */
function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains("dark"))
    update()
    // Watch for theme flips while the page is open
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

/* ------------------------------------------------------------------ */
/* Color helpers — keep admin-chosen colors visible at small sizes    */
/* ------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/**
 * Convert any CSS color (rgb(), rgba(), hsl(), named colors) to hex so the
 * SVG gradient can consume it. SVG paint servers ignore CSS color functions
 * in some engines — normalizing here prevents a black fallback fill.
 */
function cssColorToHex(input: string): string | null {
  const raw = input.trim()
  if (raw.startsWith("#")) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(raw)
    if (!m) return null
    let h = m[1].slice(0, 6)
    if (h.length === 3) h = h.split("").map((c) => c + c).join("")
    return `#${h.toLowerCase()}`
  }
  // rgb()/rgba() — also tolerates percentages (rgb(100%, 0%, 0%))
  const fnMatch = /^(rgba?|hsla?)\(([^)]+)\)$/i.exec(raw)
  if (fnMatch) {
    const fn = fnMatch[1].toLowerCase()
    const parts = fnMatch[2]
      .split(/[\s,/]+/)
      .filter(Boolean)
    const num = (v: string, scale = 255) => {
      if (v.endsWith("%")) return Math.round((parseFloat(v) / 100) * scale)
      return Math.round(parseFloat(v))
    }
    if ((fn === "rgb" || fn === "rgba") && parts.length >= 3) {
      const r = Math.max(0, Math.min(255, num(parts[0])))
      const g = Math.max(0, Math.min(255, num(parts[1])))
      const b = Math.max(0, Math.min(255, num(parts[2])))
      return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`
    }
    if ((fn === "hsl" || fn === "hsla") && parts.length >= 3) {
      const h = ((parseFloat(parts[0]) % 360) + 360) % 360
      const s = Math.max(0, Math.min(1, parts[1].endsWith("%") ? parseFloat(parts[1]) / 100 : parseFloat(parts[1])))
      const l = Math.max(0, Math.min(1, parts[2].endsWith("%") ? parseFloat(parts[2]) / 100 : parseFloat(parts[2])))
      // Convert HSL → RGB
      const c = (1 - Math.abs(2 * l - 1)) * s
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
      const m1 = l - c / 2
      let rp = 0, gp = 0, bp = 0
      if (h < 60) [rp, gp, bp] = [c, x, 0]
      else if (h < 120) [rp, gp, bp] = [x, c, 0]
      else if (h < 180) [rp, gp, bp] = [0, c, x]
      else if (h < 240) [rp, gp, bp] = [0, x, c]
      else if (h < 300) [rp, gp, bp] = [x, 0, c]
      else [rp, gp, bp] = [c, 0, x]
      const r = Math.round((rp + m1) * 255)
      const g = Math.round((gp + m1) * 255)
      const b = Math.round((bp + m1) * 255)
      return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`
    }
    return null
  }
  // Named colors that appear in the wild for badges — avoid canvas round-trip
  // which can throw in SSR/edge runtimes.
  const named: Record<string, string> = {
    red: "#ff0000", blue: "#0000ff", green: "#008000", yellow: "#ffff00",
    orange: "#ffa500", purple: "#800080", pink: "#ffc0cb", gold: "#ffd700",
    cyan: "#00ffff", magenta: "#ff00ff", teal: "#008080", lime: "#00ff00",
    white: "#ffffff", black: "#000000", silver: "#c0c0c0", gray: "#808080",
    grey: "#808080", crimson: "#dc143c", navy: "#000080", violet: "#ee82ee",
    indigo: "#4b0082", aqua: "#00ffff", fuchsia: "#ff00ff",
  }
  return named[raw.toLowerCase()] ?? null
}

/** Perceived luminance 0..1 (Rec. 601). */
function luminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 1
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
}

/** Mix a hex color toward white by `amount` 0..1. */
function mixTowardWhite(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const ch = rgb.map((c) => Math.round(c + (255 - c) * amount))
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Sanitize + normalize an admin-chosen color to a safe hex. Non-hex inputs
 * (rgb(), named colors, JSON artifacts) are converted; unparseable values
 * return null so the caller can drop them instead of painting black.
 */
function sanitizeColor(input: string): string | null {
  return cssColorToHex(String(input ?? ""))
}

/**
 * Raise custom badge colors to a visibility floor: anything with luminance
 * below ~0.16 (near-black at 17px) is lifted toward its hue's brighter self.
 * Keeps the admin's chosen hue, just never renders as a black blob.
 */
function visibleColor(hex: string): string {
  const norm = sanitizeColor(hex)
  if (!norm) return hex
  const lum = luminance(norm)
  if (lum >= 0.16) return norm
  const amount = Math.min(0.55, (0.16 - lum) * 2.2 + 0.18)
  return mixTowardWhite(norm, amount)
}

/* ------------------------------------------------------------------ */
/* Badge silhouettes — each variant gets a distinct SHAPE             */
/* ------------------------------------------------------------------ */

/** 12-point scalloped rosette (verified) */
function RosetteShape({ fill }: { fill: string }) {
  return (
    <path
      d="M24 2l3.1 4.6 5.1-2 1.4 5.3 5.4-.7-.4 5.4 5.2 1.5-2.2 5 4.2 3.5-3.7 3.9 2.4 4.9-5.1 1.7.2 5.4-5.4-.4-2 5-4.6-2.9L24 46l-3.6-3.8-4.6 2.9-2-5-5.4.4.2-5.4-5.1-1.7 2.4-4.9L2.2 25l4.2-3.5-2.2-5 5.2-1.5-.4-5.4 5.4.7L15.8 5l5.1 2L24 2z"
      fill={fill}
    />
  )
}

/** Hexagon (team) */
function HexShape({ fill }: { fill: string }) {
  return <path d="M24 2l19 11v22L24 46 5 35V13L24 2z" fill={fill} />
}

/** Shield (emerald / org) */
function ShieldShape({ fill }: { fill: string }) {
  return <path d="M24 2l18 6v14c0 11-7.5 19.5-18 24C13.5 41.5 6 33 6 22V8l18-6z" fill={fill} />
}

/** 5-point star (gold / sponsor) */
function StarShape({ fill }: { fill: string }) {
  return (
    <path
      d="M24 3l5.9 12.1 13.3 1.9-9.6 9.4 2.3 13.3L24 33.5 12.1 39.7l2.3-13.3-9.6-9.4 13.3-1.9L24 3z"
      fill={fill}
    />
  )
}

export function VerifiedSeal({
  title = "Verified",
  variant = "verified",
  colors,
  size = 20,
  className,
  static: isStatic = false,
}: VerifiedSealProps) {
  const [drawn, setDrawn] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  // useId() is stable across SSR + hydration. Math.random() ids mismatched
  // between server and client, so the fill referenced a gradient id that
  // didn't exist in the DOM and Chrome fell back to BLACK — the reported bug.
  // Colons are stripped because some SVG/WebView engines mishandle them in
  // url(#...) fragment references.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const isDark = useIsDarkTheme()
  const spec = VARIANTS[variant]

  useEffect(() => {
    if (isStatic) {
      setDrawn(true)
      return
    }
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setDrawn(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          const t = setTimeout(() => setDrawn(true), 80)
          io.disconnect()
          return () => clearTimeout(t)
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isStatic])

  // Custom colors override the variant palette (admin checkmarks) — normalized
  // to hex and luminance-floored so near-black picks stay visible. Invalid
  // colors are dropped so the variant palette shows instead of black.
  const stops = colors?.length ? colors.map(visibleColor).filter((c) => c.trim().startsWith("#")) : null
  const hasCustom = !!stops?.length
  const from = hasCustom ? stops![0] : isDark ? spec.darkFrom : spec.lightFrom
  const to = hasCustom ? stops![1] ?? stops![0] : isDark ? spec.darkTo : spec.lightTo
  const solid = hasCustom && stops!.length === 1 ? stops![0] : null
  const ringColor = hasCustom ? "rgba(0,0,0,0.12)" : spec.ring

  // In light theme, drop an outer white ring + soft colored shadow so the seal
  // pops against light cards instead of washing out.
  const outerShadow = isDark
    ? "drop-shadow(0 1px 2px rgba(0,0,0,0.45))"
    : `drop-shadow(0 1px 2px ${from}66) drop-shadow(0 0 0.5px rgba(0,0,0,0.25))`

  const Shape =
    variant === "team" ? HexShape : variant === "emerald" ? ShieldShape : variant === "gold" ? StarShape : RosetteShape

  // Checkmark scaled relative to the badge shape (star/hex leave less room)
  const checkScale = variant === "gold" ? 0.5 : variant === "verified" ? 0.56 : 0.6

  return (
    <span
      ref={ref}
      role="img"
      aria-label={title}
      title={title}
      className={cn("relative inline-flex shrink-0 align-[-3px]", className)}
      style={{ width: size, height: size }}
    >
      {/* Soft glow halo — behind the badge, theme-aware opacity */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full blur-[5px]",
          !isStatic && "animate-[seal-glow_3.2s_ease-in-out_infinite]",
        )}
        style={{
          background: solid
            ? `radial-gradient(circle, ${solid}55 55%, transparent 100%)`
            : `radial-gradient(circle, ${from}${isDark ? "66" : "44"} 55%, transparent 100%)`,
          opacity: isDark ? 0.7 : 0.55,
        }}
      />

      {/* Badge body with the variant's silhouette */}
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        className="relative"
        style={{ filter: outerShadow }}
      >
        <defs>
          <linearGradient id={`${uid}-fill`} x1="0%" y1="0%" x2="100%" y2="100%">
            {solid ? (
              <>
                <stop offset="0%" stopColor={solid} />
                <stop offset="100%" stopColor={solid} />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={from} />
                <stop offset="100%" stopColor={to} />
              </>
            )}
          </linearGradient>
        </defs>
        {/* Solid underlay: if the gradient reference ever fails to resolve
            (engine quirk), the shape still paints in `from` instead of the
            SVG-spec black fallback. This is the root-cause fix. */}
        <Shape fill={from} />
        <Shape fill={`url(#${uid}-fill)`} />
        {/* Inner white ring — separates badge from backgrounds of any color */}
        <circle cx="24" cy="24" r="13.5" fill="none" stroke={ringColor} strokeWidth="1.6" opacity={solid ? 0.5 : 0.45} />
        {/* Dome highlight */}
        <ellipse cx="19" cy="15.5" rx="9" ry="5.5" fill="rgba(255,255,255,0.3)" />
      </svg>

      {/* Light sweep shimmer (skipped when static) */}
      {!isStatic && (
        <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute inset-y-0 -left-full w-1/2 animate-[seal-shimmer_4.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/55 to-transparent" />
        </span>
      )}

      {/* The checkmark — draws itself in */}
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width={size * checkScale}
        height={size * checkScale}
      >
        <path
          d="M4.5 12.6l5 5L20 6.8"
          fill="none"
          stroke={spec.check}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={drawn ? undefined : { strokeDasharray: 24, strokeDashoffset: 24 }}
          className={cn(drawn && !isStatic && "animate-[seal-check_0.45s_ease-out_both]")}
        />
      </svg>
    </span>
  )
}

/** Named export for the default verified variant (convenience). */
export function VerifiedCheck(props: Omit<VerifiedSealProps, "variant">) {
  return <VerifiedSeal variant="verified" {...props} />
}
