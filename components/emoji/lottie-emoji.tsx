"use client"

import { useEffect, useState } from "react"
import { Lottie } from "@/components/ui/lottie"
import { cn } from "@/lib/utils"

/**
 * Lazy Lottie player for the handful of emoji mirrored as JSON.
 *
 * This lives in its own module so the animation JSON — and the player — are
 * only fetched when a caller explicitly asks for the higher-quality format.
 */
export function LottieEmoji({
  src,
  size,
  className,
  label,
}: {
  src: string
  size: number | string
  className?: string
  label?: string
}) {
  const [animation, setAnimation] = useState<object | null>(null)
  const dimension = typeof size === "number" ? `${size}px` : size

  useEffect(() => {
    let cancelled = false
    setAnimation(null)
    fetch(src, { cache: "force-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json && Array.isArray(json.layers)) setAnimation(json)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [src])

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ width: dimension, height: dimension }}
      className={cn("inline-block align-[-0.15em]", className)}
    >
      {animation ? <Lottie animation={animation} loop label={label} className="h-full w-full" /> : null}
    </span>
  )
}
