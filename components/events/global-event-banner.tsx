"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sparkles, Trophy, Video, Users, ArrowRight, Star, Calendar, Clock } from "lucide-react"
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

      if (res.ok) {
        setJoined(true)
        toast({
          title: "RSVP Confirmed! 🎉",
          description: `You are set for "${featuredEvent.title}".`
        })
      }
    } catch (err) {
      console.error("RSVP error:", err)
    }
  }

  return (
    <div className="relative my-4 overflow-hidden rounded-3xl border border-border bg-gradient-to-r from-primary/10 via-card to-accent/10 p-5 shadow-sm sm:p-6">
      {/* Background Glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`${badgeConfig.className} flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold shadow-md`}>
              {badgeConfig.dot && <span className="h-2 w-2 animate-ping rounded-full bg-white" />}
              {badgeConfig.label}
            </Badge>
            <Badge className="flex items-center gap-1 bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-xs font-extrabold text-black shadow-md">
              <Star className="h-3 w-3 fill-black" /> FEATURED EVENT
            </Badge>
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-xs text-primary">
              {featuredEvent.category}
            </Badge>
          </div>

          <h3 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {featuredEvent.title}
          </h3>

          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {featuredEvent.description}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <Video className="h-3.5 w-3.5" /> {featuredEvent.location_type}
            </span>
            <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-300">
              <Trophy className="h-3.5 w-3.5" /> {featuredEvent.reward_coins} Loop Coins Reward
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-sky-500" /> {featuredEvent.rsvp_count || 120}+ Attending
            </span>
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <Clock className="h-3.5 w-3.5" /> {formattedTime}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Button
            onClick={handleRsvp}
            disabled={joined}
            className={`rounded-full px-6 text-xs font-bold shadow-lg transition ${
              joined
                ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {joined ? "✓ Registered" : "Join Event Now"}
          </Button>

          <Button
            asChild
            variant="outline"
            className="rounded-full border-border bg-background/60 text-xs text-foreground hover:bg-muted"
          >
            <a href="/explore">
              Events Hub <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
