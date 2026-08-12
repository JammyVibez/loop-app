"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { type ActiveCosmetics, rarityRingClass } from "@/lib/cosmetics"

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
  const glowColor = aura?.color || frame?.color || "var(--theme-primary, #8b5cf6)"
  const showGlow = Boolean(aura?.glow || aura?.particles || frame?.glow || aura)

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {showGlow && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-full opacity-70 blur-md animate-pulse"
          style={{ background: `radial-gradient(circle, ${glowColor}88, transparent 70%)` }}
        />
      )}
      {aura?.particles && (
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
      <Avatar
        className={cn(
          sizeMap[size],
          "relative z-[1] border-2 border-background",
          frame ? rarityRingClass(frame.rarity) : "",
        )}
        style={
          frame?.color
            ? { boxShadow: `0 0 0 2px ${frame.color}` }
            : undefined
        }
      >
        <AvatarImage src={src || undefined} alt={alt} />
        <AvatarFallback className={size === "lg" || size === "xl" ? "text-3xl font-bold" : "text-sm"}>
          {(fallback || "U").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
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
            <span>{(badge.name || "★").charAt(0)}</span>
          )}
        </span>
      )}
    </div>
  )
}
