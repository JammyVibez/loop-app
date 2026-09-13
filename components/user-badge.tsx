"use client"

import { VerifiedSeal } from "@/components/ui/verified-seal"
import { ShieldCheck, Zap, Crown, Building2, Star, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

export interface VerificationBadgeData {
  id: string
  name: string
  label?: string | null
  icon?: string | null
  colors: string[]
  description?: string | null
}

export interface UserBadgeProps {
  is_verified?: boolean
  is_team_member?: boolean
  is_sponsor?: boolean
  is_premium?: boolean
  is_organization?: boolean
  organization_badge_url?: string
  organization_name?: string
  email?: string
  username?: string
  /** Admin-created custom checkmark (colors can be solid or gradient). */
  badge?: VerificationBadgeData | null
  showText?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

/** Map the legacy sm/md/lg sizes to seal pixel sizes. */
const SEAL_SIZE = { sm: 14, md: 18, lg: 22 } as const

function BadgeGlyph({ icon, className }: { icon?: string | null; className: string }) {
  switch (icon) {
    case "star":
      return <Star className={cn(className, "fill-current")} />
    case "shield":
      return <Shield className={cn(className, "fill-current")} />
    case "crown":
      return <Crown className={cn(className, "fill-current")} />
    case "sparkle":
      return <Zap className={cn(className, "fill-current")} />
    default:
      return null
  }
}

export function UserBadges({
  is_verified,
  is_team_member,
  is_sponsor,
  is_premium,
  is_organization,
  organization_badge_url,
  organization_name,
  email,
  username,
  badge,
  showText = false,
  size = "md",
  className,
}: UserBadgeProps) {
  // Auto-flag designated Loop Team account (e.g. useehamza0@gmail.com or username JammyVibez)
  const isTeam =
    Boolean(is_team_member) ||
    email === "useehamza0@gmail.com" ||
    username?.toLowerCase() === "jammyvibez"

  const seal = SEAL_SIZE[size]
  const textPadding = {
    sm: "px-1 py-0.5 text-[9px]",
    md: "px-1.5 py-0.5 text-[10px]",
    lg: "px-2 py-1 text-xs",
  }

  return (
    <div className={cn("inline-flex items-center gap-1 shrink-0", className)}>
      {/* 1. Organization Badge (Custom PNG image or Emerald seal) */}
      {is_organization && (
        <span
          title={`Verified Organization: ${organization_name || username || "Partner"}`}
          className="inline-flex shrink-0"
        >
          {organization_badge_url ? (
            <img
              src={organization_badge_url}
              alt="Organization Badge"
              className={cn(
                "shrink-0",
                size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4",
              )}
            />
          ) : showText ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 font-bold text-white shadow-sm shadow-emerald-500/25 px-1.5 py-0.5 text-[10px]">
              <Building2 className="h-3 w-3 text-emerald-100 fill-emerald-900/40" />
              <span className="uppercase tracking-wider font-extrabold text-[9px]">ORG</span>
            </span>
          ) : (
            <VerifiedSeal variant="emerald" size={seal} title="Verified Organization" />
          )}
        </span>
      )}

      {/* 2. Loop Team Badge — indigo seal + optional TEAM pill */}
      {isTeam && (
        <span title="Loop Team Member" className="inline-flex shrink-0">
          {showText ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 font-bold text-white shadow-sm shadow-indigo-500/30 px-1.5 py-0.5">
              <ShieldCheck className={cn("text-cyan-300 fill-indigo-900/40", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} />
              <span className="uppercase tracking-wider font-extrabold text-[9px]">TEAM</span>
            </span>
          ) : (
            <VerifiedSeal variant="team" size={seal} title="Loop Team Member" />
          )}
        </span>
      )}

      {/* 3. Sponsor Mark — golden seal + optional SPONSOR pill */}
      {is_sponsor && (
        <span title="Loop Official Sponsor" className="inline-flex shrink-0">
          {showText ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 font-bold text-black shadow-sm shadow-amber-500/25 px-1.5 py-0.5">
              <Zap className={cn("text-amber-950 fill-amber-300", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} />
              <span className="uppercase tracking-wider font-extrabold text-[9px]">SPONSOR</span>
            </span>
          ) : (
            <VerifiedSeal variant="gold" size={seal} title="Loop Official Sponsor" />
          )}
        </span>
      )}

      {/* 4. Admin custom checkmark — colors can be a solid hex or a gradient */}
      {badge && (
        <VerifiedSeal
          title={badge.label || `${badge.name} checkmark`}
          colors={badge.colors}
          size={seal}
        />
      )}

      {/* 5. Creator Verification Checkmark (seal replaces the plain blue dot) */}
      {is_verified && !isTeam && !badge && (
        <VerifiedSeal variant="verified" size={seal} title="Verified Creator" />
      )}

      {/* 6. Premium Crown Badge */}
      {is_premium && (
        <span
          title="Pro Subscriber"
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-black p-0.5 shadow-sm shrink-0",
            size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          )}
        >
          <Crown className="h-2.5 w-2.5 text-amber-950 fill-amber-300" />
        </span>
      )}
    </div>
  )
}
