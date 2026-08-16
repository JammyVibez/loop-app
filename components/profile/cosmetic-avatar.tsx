"use client"

import { useEffect, useRef, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  type ActiveCosmetics,
  rarityRingClass,
  cosmeticVariants,
  cosmeticGradient,
  prefersReducedMotion,
  accessoryFromItem,
  accessoryGlyph,
  badgeGlyph,
} from "@/lib/cosmetics"

type Props = {
  src?: string | null
  alt?: string
  fallback?: string
  className?: string
  cosmetics?: ActiveCosmetics | null
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeMap = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-24 w-24 sm:h-28 sm:w-28",
  xl: "h-28 w-28",
}

const PARTICLE_COLORS = ["#f472b6", "#a78bfa", "#22d3ee", "#fbbf24", "#34d399", "#fb7185"]

export function CosmeticAvatar({
  src,
  alt,
  fallback = "U",
  className,
  cosmetics,
  size = "md",
}: Props) {
  const frame = cosmetics?.frame
  const aura = cosmetics?.aura || cosmetics?.effect
  const badge = cosmetics?.badge
  const accessory = accessoryFromItem(aura || frame || null)
  const variants = cosmeticVariants(frame || aura || null)

  const glowColor = aura?.color || frame?.color || "var(--theme-primary, #8b5cf6)"
  const showGlow = Boolean(aura?.glow || aura?.particles || frame?.glow || aura || frame)
  const frameVariant = variants.frame
  const pfpVariant = variants.pfp

  // Viewport-aware pausing: stop spins/orbits once the avatar leaves the screen
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "80px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // 3D tilt-on-hover (parallax) — follows pointer, disabled for reduced motion
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false })
  const reduceMotion = prefersReducedMotion()
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || frameVariant !== "tilt_3d") return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: Math.round(py * -16 * 100) / 100, y: Math.round(px * 16 * 100) / 100, active: true })
  }
  const clearTilt = () => {
    if (reduceMotion) return
    setTilt({ x: 0, y: 0, active: false })
  }

  // PFP micro-interaction: burst / bounce on hover or tap
  const [burstKey, setBurstKey] = useState(0)
  const [bursting, setBursting] = useState(false)
  const [bouncing, setBouncing] = useState(false)
  const triggerMicro = () => {
    if (reduceMotion || pfpVariant === "none") return
    if (pfpVariant === "burst") {
      setBurstKey((k) => k + 1)
      setBursting(true)
      window.setTimeout(() => setBursting(false), 750)
    } else if (pfpVariant === "bounce") {
      setBouncing(true)
      window.setTimeout(() => setBouncing(false), 600)
    }
  }

  return (
    <div
      ref={rootRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={clearTilt}
      onPointerEnter={triggerMicro}
      onClick={triggerMicro}
      className={cn("relative inline-flex shrink-0", !inView && "cosmetic-paused", className)}
    >
      {/* Pulsing glow layer */}
      {showGlow && (frameVariant === "pulse_glow" || !frameVariant) && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-1 rounded-full",
            frameVariant === "pulse_glow" ? "cosmetic-glow-pulse" : "animate-pulse",
          )}
          style={{
            background: `radial-gradient(circle, ${glowColor}88, transparent 70%)`,
            filter: "blur(2px)",
          }}
        />
      )}

      {/* Rotating gradient ring */}
      {frameVariant === "ring_rotate" && (
        <span
          aria-hidden
          className="cosmetic-ring-rotate pointer-events-none absolute -inset-[3px] rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${glowColor}, ${glowColor}55, #fff8, ${glowColor}88, ${glowColor})`,
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 2.5px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 2.5px))",
          }}
        />
      )}

      {/* Orbiting sparkle particles */}
      {frameVariant === "orbit_particles" && (
        <>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden
              className="cosmetic-orbit-particle pointer-events-none absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
              style={{
                ["--orbit-r" as any]: "0.95em",
                ["--orbit-duration" as any]: `${2.2 + i * 0.5}s`,
                ["--orbit-delay" as any]: `${i * -0.7}s`,
                background: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                boxShadow: `0 0 6px ${PARTICLE_COLORS[i % PARTICLE_COLORS.length]}`,
                marginLeft: "-3px",
                marginTop: "-3px",
              }}
            />
          ))}
        </>
      )}

      {/* Existing sparkle ping accents (legacy aura) */}
      {aura?.particles && frameVariant === "none" && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute -top-0.5 left-1 h-1 w-1 rounded-full animate-ping"
            style={{ background: glowColor }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-1 w-1 rounded-full animate-pulse"
            style={{ background: glowColor }}
          />
        </>
      )}

      {/* PFP micro-interaction: particle burst */}
      {bursting && pfpVariant === "burst" && (
        <span key={burstKey} className="pointer-events-none absolute inset-0" aria-hidden>
          {PARTICLE_COLORS.map((c, i) => (
            <span
              key={`${burstKey}-${i}`}
              className="cosmetic-burst-particle absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
              style={{
                background: c,
                boxShadow: `0 0 6px ${c}`,
                marginLeft: "-3px",
                marginTop: "-3px",
                transform: `rotate(${i * 60}deg)`,
              }}
            />
          ))}
        </span>
      )}

      <div
        className={cn(
          "cosmetic-tilt-3d",
          bouncing && pfpVariant === "bounce" && "cosmetic-bounce",
          frameVariant === "tilt_3d" && tilt.active && "rounded-full",
        )}
        style={
          frameVariant === "tilt_3d" && tilt.active
            ? { transform: `perspective(480px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.04)` }
            : undefined
        }
      >
        <Avatar
          className={cn(
            sizeMap[size],
            "relative z-[1] border-2 border-background",
            frame ? rarityRingClass(frame.rarity) : "",
          )}
          style={frame?.color ? { boxShadow: `0 0 0 2px ${frame.color}` } : undefined}
        >
          <AvatarImage src={src || undefined} alt={alt} />
          <AvatarFallback className={size === "lg" || size === "xl" ? "text-3xl font-bold" : "text-sm"}>
            {(fallback || "U").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* Accessory overlay — crowns, hats, glasses, wings, halos and more sit on the avatar */}
      {accessory && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-[2] select-none drop-shadow",
            accessory === "crown" && "left-1/2 -top-[0.35em] -translate-x-1/2 text-[1.15em]",
            accessory === "hat" && "left-1/2 -top-[0.55em] -translate-x-1/2 text-[1.25em]",
            accessory === "glasses" && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[1em]",
            accessory === "wings" && "-right-[0.15em] top-1/2 -translate-y-1/2 -rotate-12 text-[1.1em]",
            accessory === "halo" && "left-1/2 -top-[0.7em] -translate-x-1/2 text-[1.05em]",
            accessory === "cat" && "left-1/2 -top-[0.4em] -translate-x-1/2 text-[1em]",
            accessory === "heart" && "-right-[0.1em] top-[0.05em] text-[0.95em]",
            accessory === "trophy" && "-right-[0.1em] -bottom-[0.05em] text-[0.95em]",
            accessory === "headset" && "left-1/2 -top-[0.45em] -translate-x-1/2 text-[1.1em]",
            accessory === "ring" && "-right-[0.1em] top-1/2 -translate-y-1/2 text-[0.9em]",
            (size === "lg" || size === "xl") &&
              (accessory === "crown" ||
              accessory === "hat" ||
              accessory === "wings" ||
              accessory === "halo" ||
              accessory === "headset"
                ? "text-3xl sm:text-4xl"
                : "text-2xl"),
          )}
        >
          {accessoryGlyph(aura || frame || null)}
        </span>
      )}

      {/* Badge */}
      {badge && (
        <span
          title={badge.name || "Badge"}
          className={cn(
            "absolute -bottom-1 -right-1 z-[2] flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-background bg-card text-[10px] font-bold shadow",
            size === "lg" || size === "xl" ? "h-7 w-7 text-xs" : "",
            rarityRingClass(badge.rarity),
          )}
        >
          {badge.icon_url || badge.preview_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(badge.icon_url || badge.preview_url) as string}
              alt={badge.name || "Badge"}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="leading-none">{badgeGlyph(badge)}</span>
          )}
        </span>
      )}
    </div>
  )
}

/** Convenience gradient helper for catalog previews. */
export { cosmeticGradient }
