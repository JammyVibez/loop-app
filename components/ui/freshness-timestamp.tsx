"use client"

import React, { useState, useEffect } from "react"
import { formatDistanceToNow, format } from "date-fns"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Clock } from "lucide-react"

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
    return <span className={`text-slate-400 text-xs ${className}`}>Unknown date</span>
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

  // Color & freshness badge styling
  let freshnessClass = "text-slate-400 hover:text-slate-300"
  let dotColor = null

  if (isFuture) {
    // Future dates — always show as an active countdown
    if (absMinutes < 60) {
      freshnessClass = "text-amber-400 font-semibold hover:text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
      dotColor = "bg-amber-400 shadow-[0_0_6px_#fbbf24] animate-pulse"
    } else if (absHours < 24) {
      freshnessClass = "text-cyan-400 font-semibold hover:text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
      dotColor = "bg-cyan-400 shadow-[0_0_6px_#22d3ee]"
    } else {
      freshnessClass = "text-teal-300 font-medium hover:text-teal-200"
      dotColor = "bg-teal-400"
    }
  } else if (diffMinutes < 60) {
    // Under 1hr: Bright glowing cyan
    freshnessClass = "text-cyan-400 font-semibold hover:text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]"
    dotColor = "bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-ping"
  } else if (diffHours < 6) {
    // 1hr - 6hr: Vivid teal
    freshnessClass = "text-teal-300 font-medium hover:text-teal-200"
    dotColor = "bg-teal-400"
  } else if (diffHours < 24) {
    // 6hr - 24hr: Fading soft cyan-gray
    freshnessClass = "text-slate-300/90 font-normal hover:text-slate-200"
  } else {
    // 24hr+: Standard muted gray
    freshnessClass = "text-slate-400/80 font-normal hover:text-slate-300"
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
        <TooltipContent side="top" className="bg-slate-900/95 border border-white/10 text-slate-100 text-xs shadow-xl">
          <p className="font-medium">{fullDateTime}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
