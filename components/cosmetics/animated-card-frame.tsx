"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { type CosmeticItem, cosmeticVariants, cosmeticGradient } from "@/lib/cosmetics"

type Props = {
  children: ReactNode
  effect?: CosmeticItem | null
  className?: string
  rounded?: string
}

/**
 * Wraps a post/loop card with an animated Pro card effect. The animated
 * border and glow layers sit *behind* the card (never over its text); the
 * shimmer pass is a very faint periodic sweep. Animations pause when the
 * card leaves the viewport (IntersectionObserver) and are disabled under
 * `prefers-reduced-motion`.
 */
export function AnimatedCardFrame({ children, effect, className, rounded = "rounded-2xl" }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(true)

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const variants = cosmeticVariants(effect)
  const variant = variants.card
  const gradient = cosmeticGradient(effect)
  if (!effect || variant === "none") return <>{children}</>

  return (
    <div
      ref={rootRef}
      className={cn("relative", !inView && "cosmetic-paused", className)}
    >
      {/* Animated gradient border — sits behind the card, only its edge peeks out */}
      {variant === "gradient_border" && (
        <div
          aria-hidden
          className={cn("cosmetic-gradient-border pointer-events-none absolute -inset-[2.5px]", rounded)}
          style={{
            background: gradient,
            backgroundSize: "300% 300%",
            filter: "blur(1px)",
            opacity: 0.9,
          }}
        />
      )}

      {/* Pulsing glowing edge — behind the card */}
      {variant === "pulse_edge" && (
        <div
          aria-hidden
          className={cn("cosmetic-glow-pulse pointer-events-none absolute -inset-1", rounded)}
          style={{
            background: `radial-gradient(ellipse at center, transparent 58%, ${gradient}66 82%, transparent 96%)`,
            filter: "blur(2px)",
          }}
        />
      )}

      {/* Soft periodic shimmer pass — very faint so text stays readable */}
      {variant === "shimmer" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit" }}>
          <div className="cosmetic-shimmer" style={{ background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.09), transparent)" }} />
        </div>
      )}

      {/* Aurora — soft shifting band across the top */}
      {variant === "aurora" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit" }}>
          <div className="cosmetic-aurora" style={{ background: `linear-gradient(100deg, transparent, ${gradient}66, transparent)` }} />
        </div>
      )}

      {/* Ember — floating sparks rising from the bottom corners */}
      {variant === "ember" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit" }}>
          {[12, 26, 40, 58, 74, 88].map((left, i) => (
            <span
              key={left}
              className="cosmetic-ember"
              style={{
                left: `${left}%`,
                bottom: "2%",
                background: gradient,
                boxShadow: `0 0 8px ${gradient}`,
                animationDelay: `${i * 0.42}s`,
                animationDuration: `${2.2 + (i % 3) * 0.7}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Ice — frost edge with slow icy shimmer */}
      {variant === "ice" && (
        <div
          aria-hidden
          className="cosmetic-ice-edge pointer-events-none absolute -inset-[2px]"
          style={{
            background: `linear-gradient(120deg, ${gradient}44, #e0f2fe88, ${gradient}66, #f0f9ff88, ${gradient}44)`,
          }}
        />
      )}

      {/* Fire edge — flickering flame gradient */}
      {variant === "fire_edge" && (
        <div
          aria-hidden
          className="cosmetic-fire-edge pointer-events-none absolute -inset-[2.5px]"
          style={{ background: `linear-gradient(90deg, #ef4444cc, #f97316cc, #fbbf24cc, #ef4444cc)`, filter: "blur(1px)" }}
        />
      )}

      {/* Neon edge — hard bright glow pulsing */}
      {variant === "neon_edge" && (
        <div
          aria-hidden
          className="cosmetic-neon-edge pointer-events-none absolute -inset-[2.5px]"
          style={{ background: gradient, opacity: 0.75 }}
        />
      )}

      {/* Hologram — iridescent hue-shifting border */}
      {variant === "hologram" && (
        <div
          aria-hidden
          className="cosmetic-holo pointer-events-none absolute -inset-[2.5px]"
          style={{
            background: `linear-gradient(120deg, #f472b6cc, #a78bfacc, #22d3eecc, #34d399cc, #f472b6cc)`,
            opacity: 0.85,
          }}
        />
      )}

      {/* Rainbow dash — rotating conic dashed border */}
      {variant === "rainbow_dash" && (
        <div aria-hidden className="pointer-events-none absolute -inset-[2.5px]" style={{ borderRadius: "inherit" }}>
          <div
            className="cosmetic-rainbow-dash"
            style={{
              position: "absolute",
              inset: 0,
              background: `conic-gradient(from 0deg, #f43f5e, #f59e0b, #22c55e, #06b6d4, #8b5cf6, #f43f5e)`,
              borderRadius: "inherit",
              mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              maskComposite: "exclude",
              WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              padding: "2.5px",
            }}
          />
        </div>
      )}

      {/* The card itself on top */}
      <div className="relative z-[1] h-full">{children}</div>
    </div>
  )
}
