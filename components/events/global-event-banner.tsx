"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Video, Users, ArrowRight, Star, Clock } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { type GlobalEvent } from "./global-events-hub"
import { getEventStatus, formatEventTime, getEventStatusBadge } from "@/lib/events"
import { useLiveEventTimer } from "@/hooks/use-events-state"

export function GlobalEventBanner() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { checkStatus } = useLiveEventTimer(15000)
  const [featuredEvent, setFeaturedEvent] = useState<GlobalEvent | null>(null)
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    const loadFeaturedEvent = async () => {
      try {
        const res = await fetch("/api/events?featured=true")
        if (res.ok) {
          const data = await res.json()
          if (data.events && data.events.length > 0) {
            setFeaturedEvent(data.events[0])
          }
        }
      } catch (err) {
        console.error("Failed to load featured event banner:", err)
      }
    }
    loadFeaturedEvent()
  }, [])

  if (!featuredEvent) return null

  const currentStatus = checkStatus(featuredEvent)
  const badgeConfig = getEventStatusBadge(currentStatus)
  const formattedTime = formatEventTime(featuredEvent.starts_at, currentStatus)

  const handleRsvp = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please log in to register for events.", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ event_id: featuredEvent.id })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not RSVP for this event")
      setJoined(true)
      toast({
        title: "RSVP confirmed",
        description: `You are set for "${featuredEvent.title}".`,
      })
    } catch (err: any) {
      console.error("RSVP error:", err)
      toast({
        title: "Could not RSVP",
        description: err?.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="h-0.5 bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500" />
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={`${badgeConfig.className} flex items-center gap-1 px-1.5 py-0 text-[10px] font-semibold`}>
              {badgeConfig.dot && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
              {badgeConfig.label}
            </Badge>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
              <Star className="h-3 w-3 fill-current" /> Featured
            </span>
            <span className="text-[10px] text-muted-foreground">· {featuredEvent.category}</span>
          </div>

          <h3 className="mt-1.5 line-clamp-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {featuredEvent.title}
          </h3>

          <p className="mt-1 line-clamp-2 max-w-2xl text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            {featuredEvent.description}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-foreground/70" /> {formattedTime}
            </span>
            <span className="flex items-center gap-1">
              <Video className="h-3 w-3 text-foreground/70" /> {featuredEvent.location_type}
            </span>
            <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
              <Trophy className="h-3 w-3" /> {featuredEvent.reward_coins} coin reward
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-sky-500" />
              {featuredEvent.rsvp_count ? `${featuredEvent.rsvp_count} attending` : "Be the first to RSVP"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
          <Button
            onClick={handleRsvp}
            disabled={joined}
            size="sm"
            className={`h-8 rounded-full px-3.5 text-[11px] font-semibold ${
              joined
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 shadow-none hover:bg-emerald-500/10 dark:text-emerald-300"
                : ""
            }`}
          >
            {joined ? "Registered" : "Join event"}
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-8 rounded-full px-2.5 text-[11px] text-muted-foreground">
            <Link href="/explore?tab=events">
              Details <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
