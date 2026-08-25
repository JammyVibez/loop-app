"use client"

import { useMemo } from "react"

interface FramedAvatarProps {
  avatarUrl?: string | null
  frameId?: number | null
  frameImageUrl?: string | null
  frameName?: string | null
  size?: number
  className?: string
  alt?: string
}

/**
 * Renders a user avatar with an optional PFP frame overlay.
 * Frames are SVG circles drawn around the avatar.
 */
export function FramedAvatar({
  avatarUrl,
  frameId,
  frameImageUrl,
  frameName,
  size = 40,
  className = "",
  alt = "",
}: FramedAvatarProps) {
  const strokeWidth = Math.max(2, size * 0.08)
  const r = size / 2

  const frameGradients: Record<string, string[]> = {
    Golden: ["#ffd700", "#ffaa00", "#ffd700"],
    "Neon Glow": ["#00ff88", "#00ccff", "#ff00ff"],
    "Pixel Art": ["#ff6b6b", "#4ecdc4", "#45b7d1"],
    Galaxy: ["#667eea", "#764ba2", "#6B8DD6"],
    Fire: ["#ff4500", "#ff8c00", "#ffd700"],
    Diamond: ["#b9f2ff", "#e0f7fa", "#80deea"],
    Rainbow: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"],
    Galactic: ["#0f0c29", "#302b63", "#7c3aed"],
    Cyber: ["#00f0ff", "#0080ff", "#00f0ff"],
    Frost: ["#e3f2fd", "#bbdefb", "#90caf9"],
    Dragon: ["#8b0000", "#ff4500", "#8b0000"],
  }

  const hasFrame = frameId && frameName && frameName !== "None"
  const gradientColors = useMemo(() => {
    if (!hasFrame || !frameName) return null
    return frameGradients[frameName] || ["#8b5cf6", "#a78bfa", "#c084fc"]
  }, [hasFrame, frameName])

  const gradId = `fg-${frameId || 0}-${size}`
  const isRainbow = frameName === "Rainbow"

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* Avatar image */}
      <div
        className="w-full h-full rounded-full overflow-hidden bg-muted"
        style={{ padding: hasFrame ? strokeWidth : 0 }}
      >
        {avatarUrl ? (
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(avatarUrl)}`}
            alt={alt}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <div className="w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold"
            style={{ fontSize: size * 0.35 }}
          >
            {(alt || "?").charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Frame overlay */}
      {hasFrame && gradientColors && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          <defs>
            {isRainbow ? (
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%"
                gradientTransform="rotate(45)">
                {gradientColors.map((color, i) => (
                  <stop key={i} offset={`${(i / (gradientColors.length - 1)) * 100}%`} stopColor={color} />
                ))}
              </linearGradient>
            ) : (
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={gradientColors[0]} />
                <stop offset="50%" stopColor={gradientColors[1]} />
                <stop offset="100%" stopColor={gradientColors[gradientColors.length - 1]} />
              </linearGradient>
            )}
          </defs>
          <circle
            cx={r}
            cy={r}
            r={r - strokeWidth / 2}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            opacity={0.85}
          />
        </svg>
      )}
    </div>
  )
}
