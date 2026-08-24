"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"

type WatermarkOverlayProps = {
  /** Opacity 0–1 */
  opacity?: number
  /** Position: corner or center */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center"
  /** Whether to animate position periodically */
  animated?: boolean
}

/**
 * TikTok-style watermark overlay.
 * Shows a small, subtle Loop logo + username in one corner — NOT repeating text
 * all over the image. Optionally animates position periodically.
 *
 * This is a deterrent layer, not a guarantee.
 */
export function WatermarkOverlay({
  opacity = 0.35,
  position: initialPosition = "bottom-right",
  animated = true,
}: WatermarkOverlayProps) {
  const { user } = useAuth()
  const [pos, setPos] = useState(initialPosition)

  // Animate position every 3 seconds (like TikTok)
  useEffect(() => {
    if (!animated) return
    const positions = ["top-left", "top-right", "bottom-left", "bottom-right"] as const
    const interval = setInterval(() => {
      setPos((prev) => {
        if (prev === "center") return "bottom-right"
        const current = positions.indexOf(prev as typeof positions[number])
        return positions[(current + 1) % positions.length]
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [animated])

  const posClasses = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-3",
    "bottom-left": "bottom-3 left-3",
    "bottom-right": "bottom-3 right-3",
    "center": "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 transition-all duration-700 ease-in-out ${posClasses[pos]}`}
      style={{ opacity }}
    >
      {/* Small Loop logo + username badge */}
      <div className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-2.5 py-1">
        {/* Loop infinity icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="text-white/80"
        >
          <path
            d="M12 4C8 4 4 7 4 12s4 8 8 8 8-4 8-8-4-8-8-8zm0 12c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z"
            fill="currentColor"
            opacity="0.9"
          />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
        <span className="text-[10px] font-medium text-white/80">
          @{user?.username || "loop"}
        </span>
      </div>
    </div>
  )
}
