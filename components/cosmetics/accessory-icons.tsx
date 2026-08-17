"use client"

import { useId } from "react"
import type { AvatarAccessory } from "@/lib/cosmetics"

/**
 * Vector accessory icons — every avatar overlay (crown, hat, glasses, wings,
 * halo, cat ears, heart, trophy, headset, ring) is a crisp inline SVG filled
 * with a gradient derived from the equipped cosmetic's colors. No emojis, no
 * external assets — scales with the avatar and always matches the item.
 */

interface AccessoryIconProps {
  type: AvatarAccessory
  /** Primary glow color (e.g. the equipped item's color). */
  color?: string
  /** Secondary gradient color — defaults to a light tint of `color`. */
  color2?: string
  className?: string
}

function lighten(hex: string, amount = 0.35): string {
  const raw = hex.replace("#", "")
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return "#ffffff"
  const n = (i: number) => {
    const v = Number.parseInt(full.slice(i, i + 2), 16)
    return Math.round(v + (255 - v) * amount)
  }
  return `#${[n(0), n(2), n(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

function Icon({
  children,
  color,
  color2,
  className,
}: {
  children: (id: string) => React.ReactNode
  color?: string
  color2?: string
  className?: string
}) {
  const id = useId().replace(/[:]/g, "")
  const c1 = color || "#f59e0b"
  const c2 = color2 || lighten(c1)
  const gid = `acc-${id}`
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" style={{ filter: `drop-shadow(0 1px 2px ${c1}66)` }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      {children(gid)}
    </svg>
  )
}

export function AccessoryIcon({ type, color, color2, className }: AccessoryIconProps) {
  if (!type) return null
  const common = { color, color2, className }

  switch (type) {
    case "crown":
      return (
        <Icon {...common}>
          {(gid) => (
            <g fill={`url(#${gid})`}>
              <path d="M10 46 6 18l14 10 12-16 12 16 14-10-4 28H10Z" />
              <circle cx="18" cy="42" r="3.5" fill="#fff" opacity="0.85" />
              <circle cx="32" cy="44" r="4" fill="#fff" opacity="0.9" />
              <circle cx="46" cy="42" r="3.5" fill="#fff" opacity="0.85" />
            </g>
          )}
        </Icon>
      )
    case "hat":
      return (
        <Icon {...common}>
          {(gid) => (
            <g>
              <path d="M32 8c-4 10-9 18-13 24-2 3 2 5 6 5h14c4 0 8-2 6-5-4-6-9-14-13-24Z" fill={`url(#${gid})`} />
              <path d="M12 34c4 6 36 6 40 0l4 14c-14 8-34 8-48 0l4-14Z" fill={`url(#${gid})`} />
              <path d="M14 36h36v4H14z" fill="#fff" opacity="0.35" />
              <circle cx="32" cy="10" r="3" fill="#fff" opacity="0.9" />
            </g>
          )}
        </Icon>
      )
    case "glasses":
      return (
        <Icon {...common}>
          {(gid) => (
            <g fill="none" stroke={`url(#${gid})`} strokeWidth="4" strokeLinecap="round">
              <rect x="8" y="22" width="20" height="14" rx="6" />
              <rect x="36" y="22" width="20" height="14" rx="6" />
              <path d="M28 28h8" />
              <path d="M8 26c-3 2-3 6 0 8M56 26c3 2 3 6 0 8" />
            </g>
          )}
        </Icon>
      )
    case "wings":
      return (
        <Icon {...common}>
          {(gid) => (
            <g fill={`url(#${gid})`} opacity="0.95">
              <path d="M6 30c10-2 20 2 26 10-8 2-16 0-22-4-4-2-5-5-4-6Z" />
              <path d="M58 30c-10-2-20 2-26 10 8 2 16 0 22-4 4-2 5-5 4-6Z" />
              <path d="M10 40c8 4 18 4 24-2-4 6-12 10-24 8v-6Z" opacity="0.5" />
              <path d="M54 40c-8 4-18 4-24-2 4 6 12 10 24 8v-6Z" opacity="0.5" />
            </g>
          )}
        </Icon>
      )
    case "halo":
      return (
        <Icon {...common}>
          {(gid) => (
            <g fill="none" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round">
              <ellipse cx="32" cy="12" rx="20" ry="8" />
              <path d="M12 12c0-6 9-10 20-10s20 4 20 10" opacity="0.45" />
            </g>
          )}
        </Icon>
      )
    case "cat":
      return (
        <Icon {...common}>
          {(gid) => (
            <g fill={`url(#${gid})`}>
              <path d="M10 30 18 8l14 12 14-12 8 22c-2 10-12 16-36 16 0-14-4-16-8-16Z" />
              <path d="M18 36c6-3 12-3 18 0l2 6c-6 2-12 2-18 0l-2-6Z" opacity="0.55" />
              <circle cx="24" cy="40" r="2.6" fill="#fff" />
              <circle cx="40" cy="40" r="2.6" fill="#fff" />
              <path d="M28 48c3 2 5 2 8 0" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
            </g>
          )}
        </Icon>
      )
    case "heart":
      return (
        <Icon {...common}>
          {(gid) => (
            <path
              fill={`url(#${gid})`}
              d="M32 56S6 40 6 22c0-8 6-14 13-14 5 0 9 3 13 9 4-6 8-9 13-9 7 0 13 6 13 14 0 18-26 34-26 34Z"
            />
          )}
        </Icon>
      )
    case "trophy":
      return (
        <Icon {...common}>
          {(gid) => (
            <g fill={`url(#${gid})`}>
              <path d="M14 8h36v4c0 12-6 20-18 20S14 24 14 12V8Z" />
              <path d="M14 12c-4 0-6 4-5 9 1 5 4 9 8 9l-3-8-2-6 2-4Z" opacity="0.7" />
              <path d="M50 12c4 0 6 4 5 9-1 5-4 9-8 9l3-8 2-6-2-4Z" opacity="0.7" />
              <path d="M28 44h8v6h-8zM22 52h20v4H22z" opacity="0.85" />
            </g>
          )}
        </Icon>
      )
    case "headset":
      return (
        <Icon {...common}>
          {(gid) => (
            <g fill="none" stroke={`url(#${gid})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 34v-6c0-11 9-20 20-20s20 9 20 20v6" />
              <path d="M8 34c0-4 3-7 7-7s7 3 7 7v8c0 4-3 7-7 7s-7-3-7-7v-8Z" fill={`url(#${gid})`} stroke="none" />
              <path d="M42 34c0-4 3-7 7-7s7 3 7 7v8c0 4-3 7-7 7s-7-3-7-7v-8Z" fill={`url(#${gid})`} stroke="none" />
              <path d="M30 14c6 0 8 4 8 10" opacity="0.8" />
            </g>
          )}
        </Icon>
      )
    case "ring":
      return (
        <Icon {...common}>
          {(gid) => (
            <g>
              <path d="M32 8 38 26H26L32 8Z" fill={`url(#${gid})`} />
              <path d="M22 28c-2-6 4-10 10-10s12 4 10 10c-2 7-7 11-10 16-3-5-8-9-10-16Z" fill={`url(#${gid})`} opacity="0.9" />
              <path d="M28 30c2-2 5-3 8-3" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
            </g>
          )}
        </Icon>
      )
    default:
      return null
  }
}

/** Badge fallback mark (used when a badge has no icon asset) — a gradient star. */
export function BadgeStarIcon({ color = "#38bdf8", className }: { color?: string; className?: string }) {
  const id = useId().replace(/[:]/g, "")
  const gid = `badge-${id}`
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gid})`}
        d="M32 4l7.5 15.2 16.8 2.4-12.2 11.9 2.9 16.7L32 42.4 17 50.2l2.9-16.7L7.7 21.6l16.8-2.4L32 4Z"
      />
    </svg>
  )
}
