"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { prefersReducedMotion } from "@/lib/cosmetics"
import { ProxyImg } from "@/components/ui/proxy-img"

type Props = {
  /** Profile banner image URL (falls back to the gradient when absent). */
  src?: string | null
  /** Enable the 3D parallax/tilt treatment (Pro/sponsor profiles only). */
  enabled?: boolean
  /** Extra inline background for the fallback state. */
  fallbackClassName?: string
  className?: string
  /** Overlay content (e.g. the "Edit cover" button). */
  children?: ReactNode
}

/**
 * Profile cover photo with a subtle depth treatment reserved for Pro /
 * sponsor profiles: the banner tilts slightly following the pointer and
 * layers drift at different speeds while the page scrolls. The effect is
 * CSS-transform only (cheap), pauses when the banner leaves the viewport,
 * and is fully disabled under `prefers-reduced-motion`.
 */
export function ProfileBanner3D({
  src,
  enabled = false,
  fallbackClassName = "",
  className,
  children,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(true)
  const reduceMotion = prefersReducedMotion()
  const active = enabled && !reduceMotion

  // Viewport-aware pause
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Subtle pointer tilt (perspective + rotateX/rotateY)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    // Rotate gently (±3deg) — enough to read as depth, not a wobble.
    setTilt({ x: Math.round(py * -5 * 100) / 100, y: Math.round(px * 6 * 100) / 100 })
  }
  const clearTilt = () => setTilt({ x: 0, y: 0 })

  // Scroll parallax: the cover drifts slower than the page.
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setScrollY(window.scrollY))
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [active])

  const coverTransform = active
    ? `translate3d(0, ${Math.min(24, scrollY * 0.18)}px, 0) scale(1.12)`
    : "scale(1.06)"

  return (
    <div
      ref={rootRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={clearTilt}
      className={cn("relative z-0 overflow-hidden", !inView && "cosmetic-paused", className)}
      style={
        active && tilt.x !== 0
          ? {
              perspective: "900px",
              transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`,
              transition: "transform 0.2s ease-out",
              transformStyle: "preserve-3d",
            }
          : undefined
      }
    >
      {/* Cover layer — moves at its own speed on scroll for a depth feel */}
      <div
        aria-hidden
        className="absolute inset-[-8%] will-change-transform"
        style={{ transform: coverTransform, transition: "transform 0.25s ease-out" }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <ProxyImg src={src} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div
            className={cn(
              "h-full w-full bg-[radial-gradient(circle_at_20%_30%,rgba(56,189,248,0.35),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(139,92,246,0.35),transparent_40%)]",
              fallbackClassName,
            )}
          />
        )}
      </div>

      {/* Foreground tint kept above the cover so overlays stay readable */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/15" />

      {children}
    </div>
  )
}
