"use client"

import { useMemo } from "react"

type WatermarkOverlayProps = {
  /** Text to repeat across the overlay */
  text?: string
  /** Opacity 0–1 */
  opacity?: number
  /** Rotation angle in degrees */
  angle?: number
  /** Spacing between watermark lines */
  spacing?: number
  /** Font size in px */
  fontSize?: number
  /** Absolute or fixed positioning */
  position?: "absolute" | "fixed"
}

/**
 * Renders a subtle, semi-transparent watermark pattern over media content.
 * Uses CSS-only approach for performance — no canvas or DOM overhead.
 *
 * The watermark is a deterrent layer, not a guarantee against screenshots.
 * Admin can toggle on/off per content type.
 */
export function WatermarkOverlay({
  text = "Loop",
  opacity = 0.08,
  angle = -30,
  spacing = 120,
  fontSize = 14,
  position = "absolute",
}: WatermarkOverlayProps) {
  const bgStyle = useMemo(() => {
    const encoded = encodeURIComponent(text)
    // Create a repeating SVG watermark pattern
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${spacing}' height='${spacing}' viewBox='0 0 ${spacing} ${spacing}'><text x='50%' y='50%' font-family='system-ui,-apple-system,sans-serif' font-size='${fontSize}' fill='white' text-anchor='middle' dominant-baseline='central' transform='rotate(${angle} ${spacing / 2} ${spacing / 2})'>${text}</text></svg>`
    return `url("data:image/svg+xml,${svg}")`
  }, [text, angle, spacing, fontSize])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none"
      style={{
        position,
        inset: 0,
        zIndex: 10,
        backgroundImage: bgStyle,
        opacity,
        mixBlendMode: "overlay",
      }}
    />
  )
}
