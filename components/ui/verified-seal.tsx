"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * VerifiedSeal — the app's verified checkmark, designed to look like an
 * award seal rather than a flat colored dot:
 *  - scalloped "seal" silhouette (like a rosette / certificate wax seal)
 *  - radial gradient fill with a soft animated glow halo
 *  - a light sweep (shimmer) that passes across it periodically
 *  - the checkmark draws itself in on first appearance
 *
 * Variants:
 *  - "verified"  — brand sky/indigo seal (default creator verification)
 *  - "gold"      — amber seal for premium/sponsor tier marks
 *  - "emerald"   — teal seal for organizations
 *  - custom      — pass `colors` (1 = solid, 2 = gradient stops)
 *
 * All motion respects `prefers-reduced-motion` (CSS handles this globally).
 */

export type SealVariant = "verified" | "gold" | "emerald" | "team"

interface VerifiedSealProps {
  /** Tooltip label, e.g. "Verified Creator" */
  title?: string
  /** Visual variant — controls gradient + glow color */
  variant?: SealVariant
  /** Custom gradient/solid colors (overrides variant). 1 = solid, 2 = gradient */
  colors?: string[]
  /** Size in px (default 18). Common sizes: 14, 16, 18, 22 */
  size?: number
  /** Extra classes on the wrapper */
  className?: string
  /** Disable the draw-on + shimmer animation (e.g. dense lists, print) */
  static?: boolean
}

const VARIANT_STYLES: Record<SealVariant, { from: string; to: string; glow: string; check: string }> = {
  verified: { from: "#38bdf8", to: "#6366f1", glow: "56,189,248", check: "#ffffff" },
  gold: { from: "#fbbf24", to: "#f59e0b", glow: "251,191,36", check: "#78350f" },
  emerald: { from: "#34d399", to: "#0d9488", glow: "52,211,153", check: "#ffffff" },
  team: { from: "#818cf8", to: "#a855f7", glow: "129,140,248", check: "#ffffff" },
}

/** The 12-point scalloped seal silhouette as an SVG path (viewBox 0 0 48 48). */
function SealShape() {
  return (
    <path
      d="M24 2l3.1 4.6 5.1-2 1.4 5.3 5.4-.7-.4 5.4 5.2 1.5-2.2 5 4.2 3.5-3.7 3.9 2.4 4.9-5.1 1.7.2 5.4-5.4-.4-2 5-4.6-2.9L24 46l-3.6-3.8-4.6 2.9-2-5-5.4.4.2-5.4-5.1-1.7 2.4-4.9L2.2 25l4.2-3.5-2.2-5 5.2-1.5-.4-5.4 5.4.7L15.8 5l5.1 2L24 2z"
      fill="url(#sealFill)"
    />
  )
}

export function VerifiedSeal({
  title = "Verified",
  variant = "verified",
  colors,
  size = 18,
  className,
  static: isStatic = false,
}: VerifiedSealProps) {
  const [drawn, setDrawn] = useState(false)
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const uid = useRef(`vs${Math.random().toString(36).slice(2, 9)}`)

  // Draw the check in when the badge first enters the viewport.
  useEffect(() => {
    setMounted(true)
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
          // Small stagger so rows of badges don't all pop at the exact same frame.
          const delay = Math.min(400, 60 + (Date.now() % 7) * 20)
          const t = setTimeout(() => setDrawn(true), delay)
          io.disconnect()
          return () => clearTimeout(t)
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [isStatic])

  const stops = colors?.length ? colors : null
  const style = VARIANT_STYLES[variant]
  const from = stops?.[0] ?? style.from
  const to = stops?.[1] ?? stops?.[0] ?? style.to
  const solid = stops && stops.length === 1 ? stops[0] : null
  const checkColor = style.check
  const glowRgb = stops?.length ? "0,0,0" : style.glow

  return (
    <span
      ref={ref}
      role="img"
      aria-label={title}
      title={title}
      className={cn("relative inline-flex shrink-0 align-[-2px]", className)}
      style={{ width: size, height: size }}
    >
      {/* Soft glow halo */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full blur-[6px] opacity-60 transition-opacity",
          !isStatic && "animate-[seal-glow_3.2s_ease-in-out_infinite]",
        )}
        style={{
          background: solid
            ? `radial-gradient(circle, rgba(${glowRgb},0) 55%, rgba(${glowRgb},0.35) 100%)`
            : `radial-gradient(circle, ${from}55 55%, ${to}66 100%)`,
        }}
      />

      {/* Scalloped seal body */}
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        className="relative"
        style={
          solid
            ? undefined
            : {
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
              }
        }
      >
        <defs>
          <radialGradient id={`${uid}-fill`} cx="35%" cy="30%" r="80%">
            {solid ? (
              <stop offset="0%" stopColor={solid} />
            ) : (
              <>
                <stop offset="0%" stopColor={from} />
                <stop offset="62%" stopColor={from} />
                <stop offset="100%" stopColor={to} />
              </>
            )}
          </radialGradient>
        </defs>
        {/* Seal body — solid colors use a simple circle, gradients use the scalloped silhouette */}
        {solid ? (
          <circle cx="24" cy="24" r="22" fill={solid} />
        ) : (
          <g>
            <SealShape />
            <circle cx="24" cy="24" r="15.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" />
          </g>
        )}
        {/* Inner highlight — gives the seal a slight 3D dome feel */}
        <ellipse cx="19" cy="16.5" rx="10" ry="6.5" fill="rgba(255,255,255,0.22)" />
      </svg>

      {/* Animated light sweep (skipped when static / solid colors) */}
      {!isStatic && !solid && mounted && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        >
          <span className="absolute inset-y-0 -left-full w-1/2 animate-[seal-shimmer_4.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </span>
      )}

      {/* The checkmark — draws itself in */}
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width={size * 0.62}
        height={size * 0.62}
      >
        <path
          d="M4.5 12.6l5 5L20 6.8"
          fill="none"
          stroke={checkColor}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={
            drawn
              ? undefined
              : {
                  strokeDasharray: 24,
                  strokeDashoffset: 24,
                }
          }
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
