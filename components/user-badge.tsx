"use client"

import { ShieldCheck, Check, Sparkles, Crown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface UserBadgeProps {
  is_verified?: boolean
  is_team_member?: boolean
  is_sponsor?: boolean
  is_premium?: boolean
  email?: string
  username?: string
  showText?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export function UserBadges({
  is_verified,
  is_team_member,
  is_sponsor,
  is_premium,
  email,
  username,
  showText = false,
  size = "md",
  className,
}: UserBadgeProps) {
  // Auto-flag designated Loop Team account (e.g. useehamza0@gmail.com or username JammyVibez)
  const isTeam =
    Boolean(is_team_member) ||
    email === "useehamza0@gmail.com" ||
    username?.toLowerCase() === "jammyvibez"

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }

  const badgePadding = {
    sm: "px-1 py-0.5 text-[9px]",
    md: "px-1.5 py-0.5 text-[10px]",
    lg: "px-2 py-1 text-xs",
  }

  return (
    <div className={cn("inline-flex items-center gap-1 shrink-0", className)}>
      {/* 1. Loop Team Badge (Indigo/Violet Shield + optional TEAM pill) */}
      {isTeam && (
        <span
          title="Loop Team Member"
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 font-bold text-white shadow-sm shadow-indigo-500/30",
            showText ? badgePadding[size] : "p-0.5"
          )}
        >
          <ShieldCheck className={cn(iconSizes[size], "text-cyan-300 fill-indigo-900/40")} />
          {showText && <span className="uppercase tracking-wider font-extrabold text-[9px]">TEAM</span>}
        </span>
      )}

      {/* 2. Sponsor Mark (Golden Sparkle / Gem + optional SPONSOR pill) */}
      {is_sponsor && (
        <span
          title="Loop Official Sponsor"
          className={cn(
            "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 font-bold text-black shadow-sm shadow-amber-500/25",
            showText ? badgePadding[size] : "p-0.5"
          )}
        >
          <Sparkles className={cn(iconSizes[size], "text-amber-950 fill-amber-300")} />
          {showText && <span className="uppercase tracking-wider font-extrabold text-[9px]">SPONSOR</span>}
        </span>
      )}

      {/* 3. Creator Verification Checkmark (Untouched Blue Checkmark) */}
      {is_verified && !isTeam && (
        <span
          title="Verified Creator"
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-sky-500 text-white font-bold shadow-sm shadow-sky-500/20 p-0.5",
            size === "sm" ? "h-3.5 w-3.5 text-[9px]" : size === "lg" ? "h-4.5 w-4.5 text-xs" : "h-4 w-4 text-[10px]"
          )}
        >
          <Check className="h-2.5 w-2.5 stroke-[3]" />
        </span>
      )}

      {/* 4. Premium Crown Badge */}
      {is_premium && (
        <span
          title="Pro Subscriber"
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black p-0.5 shadow-sm",
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
        >
          <Crown className="h-2.5 w-2.5 text-amber-950 fill-amber-300" />
        </span>
      )}
    </div>
  )
}
