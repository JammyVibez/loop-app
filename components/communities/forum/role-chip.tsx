/**
 * The chip in front of a name inside a community — the base role (Owner / Admin
 * / Mod) or one of the community's custom Powers, in that Power's colour.
 *
 * Colours are inline styles because Powers are user-defined: the chip tints its
 * own background and ring from the stored hex instead of guessing a Tailwind
 * class from an arbitrary string.
 */

export interface RoleBadgeLike {
  name: string
  color?: string | null
  icon?: string | null
  source?: string
  priority?: number
}

function withAlpha(hex: string, alpha: number) {
  const value = /^#([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!value) return `rgba(99, 102, 241, ${alpha})`
  const n = parseInt(value[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export function RoleChip({
  badge,
  className,
}: {
  badge: RoleBadgeLike | null | undefined
  className?: string
}) {
  if (!badge?.name) return null
  const color = /^#[0-9a-fA-F]{6}$/.test((badge.color || "").trim()) ? (badge.color as string) : "#6366f1"
  return (
    <span
      title={badge.source === "base" ? "Community role" : "Power"}
      className={
        className ||
        "inline-flex max-w-[8.5rem] shrink-0 items-center truncate rounded-full px-1.5 py-px text-[9px] font-bold uppercase leading-[1.6] tracking-[0.06em]"
      }
      style={{
        color,
        background: withAlpha(color, 0.14),
        boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.35)}`,
      }}
    >
      {badge.name}
    </span>
  )
}
