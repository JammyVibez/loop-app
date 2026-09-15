"use client"

import { useEffect, useState } from "react"
import { Award } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface ProfileAward {
  id: string
  name: string
  description?: string | null
  emoji: string
  color: string
  count?: number
  awarded_at?: string
}

/** Award shelf — compact inline row (profile header). */
export function ProfileAwards({ userId, compact }: { userId: string; compact?: boolean }) {
  const [awards, setAwards] = useState<ProfileAward[]>([])
  const [loaded, setLoaded] = useState(false)

  useUserAwards(userId, setAwards, setLoaded)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoaded(false)
    fetch(`/api/awards?user_id=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setAwards(data?.awards || [])
      })
      .catch(() => {
        if (!cancelled) setAwards([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (loaded && awards.length === 0) return null

  return (
    <TooltipProvider delayDuration={150}>
      <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
        <span
          className={cn(
            "inline-flex items-center gap-1 font-semibold text-amber-500",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          <Award className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          {awards.length > 0 ? `${awards.length} award${awards.length === 1 ? "" : "s"}` : "Awards"}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {awards.map((award) => (
            <Tooltip key={award.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="group relative inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-1 transition hover:scale-105"
                  style={{ boxShadow: `inset 0 0 0 1px ${award.color}33` }}
                >
                  <span className="text-sm leading-none">{award.emoji}</span>
                  {!compact && (
                    <span className="text-[11px] font-semibold" style={{ color: award.color }}>
                      {award.name}
                    </span>
                  )}
                  {(award.count || 0) > 1 && (
                    <span className="rounded-full bg-foreground/10 px-1 text-[10px] font-bold text-muted-foreground">
                      ×{award.count}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px]">
                <p className="text-xs font-semibold" style={{ color: award.color }}>
                  {award.emoji} {award.name}
                  {(award.count || 0) > 1 ? ` ×${award.count}` : ""}
                </p>
                {award.description && <p className="mt-0.5 text-xs text-muted-foreground">{award.description}</p>}
                {award.awarded_at && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Awarded {new Date(award.awarded_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  )
}

/** Shared loader — fetches the user's grouped award grants once per mount. */
function useUserAwards(
  userId: string,
  setAwards: (a: ProfileAward[]) => void,
  setLoaded: (v: boolean) => void,
) {
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoaded(false)
    fetch(`/api/awards?user_id=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setAwards(data?.awards || [])
      })
      .catch(() => {
        if (!cancelled) setAwards([])
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId, setAwards, setLoaded])
}

/** Full awards grid — used by the profile Awards tab. */
export function ProfileAwardsGrid({ userId }: { userId: string }) {
  const [awards, setAwards] = useState<ProfileAward[]>([])
  const [loaded, setLoaded] = useState(false)

  useUserAwards(userId, setAwards, setLoaded)

  if (!loaded) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Loading awards…</p>
  }

  if (awards.length === 0) {
    return (
      <div className="py-12 text-center">
        <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="font-medium">No awards yet</p>
        <p className="text-sm text-muted-foreground">Awards granted by the Loop team will appear here.</p>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid gap-3 sm:grid-cols-2">
        {awards.map((award) => (
          <Tooltip key={award.id}>
            <TooltipTrigger asChild>
              <div
                className="flex items-start gap-3 rounded-2xl border bg-card p-4"
                style={{ boxShadow: `inset 0 0 0 1px ${award.color}33` }}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: `${award.color}1a` }}
                >
                  {award.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold" style={{ color: award.color }}>
                      {award.name}
                    </p>
                    {(award.count || 0) > 1 && (
                      <span className="rounded-full bg-foreground/10 px-1.5 text-[10px] font-bold text-muted-foreground">
                        ×{award.count}
                      </span>
                    )}
                  </div>
                  {award.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{award.description}</p>
                  )}
                  {award.awarded_at && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      First awarded {new Date(award.awarded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              <p className="text-xs">Granted by the Loop team</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
