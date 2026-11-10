"use client"

import React, { useState, useEffect } from "react"
import { formatDistanceToNow, format } from "date-fns"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Clock } from "@/components/icons/lucide-compat"

interface FreshnessTimestampProps {
  date: string | Date | number
  className?: string
  showIcon?: boolean
  addSuffix?: boolean
}

export function FreshnessTimestamp({
  date,
  className = "",
  showIcon = false,
  addSuffix = true,
}: FreshnessTimestampProps) {
  const [mounted, setMounted] = useState(false)
  const [, setNow] = useState(Date.now())

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  const parsedDate = new Date(date)
  if (isNaN(parsedDate.getTime())) {
    return <span className={`text-muted-foreground text-xs ${className}`}>Unknown date</span>
  }

  const diffMs = Date.now() - parsedDate.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)

  // Relative string formatting — handle both past AND future dates
  let relativeText = ""
  const isFuture = diffMs < 0
  const absMinutes = Math.abs(diffMinutes)
  const absHours = Math.abs(diffHours)
  const absDays = Math.abs(Math.floor(absHours / 24))

  if (!mounted) {
    relativeText = formatDistanceToNow(parsedDate, { addSuffix })
  } else if (isFuture) {
    // Future date — show countdown
    if (absMinutes < 1) {
      relativeText = "in <1m"
    } else if (absMinutes < 60) {
      relativeText = `in ${absMinutes}m`
    } else if (absHours < 24) {
      const mins = absMinutes % 60
      relativeText = mins > 0 ? `in ${absHours}h ${mins}m` : `in ${absHours}h`
    } else {
      relativeText = `in ${absDays}d ${absHours % 24}h`
    }
  } else if (diffMinutes < 1) {
    relativeText = "Just now"
  } else if (diffMinutes < 60) {
    relativeText = `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    relativeText = `${diffHours}h ago`
  } else {
    relativeText = formatDistanceToNow(parsedDate, { addSuffix: true })
  }

  // Exact date/time representation on hover/tap
  const fullDateTime = format(parsedDate, "EEEE, MMMM d, yyyy 'at' h:mm a")

  // Freshness styling.
  //
  // This used to colour the timestamp itself (glowing cyan under an hour, with
  // a drop-shadow and a pinging dot) and hardcoded Tailwind slate values, which
  // ignored the theme tokens and looked wrong in the light themes. Recency is
  // now signalled by a small dot only — the text stays muted like the rest of
  // the post meta, and drop-shadows/pings are gone.
  let freshnessClass = "text-muted-foreground hover:text-foreground"
  let dotColor: string | null = null

  if (isFuture) {
    // A live countdown genuinely deserves emphasis — but only via colour.
    if (absMinutes < 60) {
      freshnessClass = "text-amber-600 dark:text-amber-400 font-semibold"
      dotColor = "bg-amber-500"
    } else if (absHours < 24) {
      freshnessClass = "text-cyan-700 dark:text-cyan-400 font-semibold"
      dotColor = "bg-cyan-500"
    } else {
      freshnessClass = "text-teal-700 dark:text-teal-400 font-medium"
      dotColor = "bg-teal-500"
    }
  } else if (diffMinutes < 60) {
    // Under 1hr
    dotColor = "bg-emerald-500"
  } else if (diffHours < 6) {
    // 1hr - 6hr
    dotColor = "bg-emerald-500/70"
  } else if (diffHours < 24) {
    // 6hr - 24hr
    dotColor = "bg-amber-500/60"
  } else {
    // 24hr+ — no dot at all, nothing to signal.
    freshnessClass = "text-muted-foreground/80 hover:text-foreground"
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 cursor-help transition-colors text-xs ${freshnessClass} ${className}`}
            title={fullDateTime}
          >
            {showIcon && <Clock className="h-3 w-3 opacity-80" />}
            {dotColor && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
            <span>{relativeText}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="border border-border bg-popover text-popover-foreground text-xs shadow-xl">
          <p className="font-medium">{fullDateTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
