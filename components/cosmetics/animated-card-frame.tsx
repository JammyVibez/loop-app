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

      {/* The card itself on top */}
      <div className="relative z-[1] h-full">{children}</div>
    </div>
  )
}
