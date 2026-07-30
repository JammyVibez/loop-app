"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Video, Users, ArrowRight, Star, Calendar } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { type GlobalEvent } from "./global-events-hub"

export function GlobalEventBanner() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
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
    <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-r from-[#07132b] via-[#091b36] to-[#0d0726] p-5 sm:p-6 shadow-xl shadow-cyan-950/20 my-4">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 h-60 w-60 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-extrabold text-xs px-2.5 py-0.5 shadow-md flex items-center gap-1">
              <Star className="h-3 w-3 fill-black" /> FEATURED EVENT
            </Badge>
            <Badge variant="outline" className="border-cyan-400/40 bg-cyan-500/10 text-cyan-300 text-xs">
              {featuredEvent.category}
            </Badge>
          </div>

          <h3 className="text-xl font-extrabold text-white sm:text-2xl tracking-tight">
            {featuredEvent.title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 leading-relaxed">
            {featuredEvent.description}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
            <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
              <Video className="h-3.5 w-3.5" /> {featuredEvent.location_type}
            </span>
            <span className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Trophy className="h-3.5 w-3.5" /> {featuredEvent.reward_coins} Loop Coins Reward
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Users className="h-3.5 w-3.5 text-blue-400" /> {featuredEvent.rsvp_count || 120}+ Attending
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
          <Button
            onClick={handleRsvp}
            disabled={joined}
            className={`rounded-full px-6 text-xs font-bold transition shadow-lg ${
              joined
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-gradient-to-r from-cyan-400 to-blue-500 text-black hover:from-cyan-300 hover:to-blue-400 shadow-cyan-500/20"
            }`}
          >
            {joined ? "✓ Registered" : "Join Event Now"}
          </Button>

          <Button
            asChild
            variant="outline"
            className="rounded-full border-white/15 bg-white/5 text-xs text-slate-200 hover:bg-white/10"
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
