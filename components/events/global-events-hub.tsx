"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProxyImg } from "@/components/ui/proxy-img"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, Trophy, Users, Star, Video, Search, ExternalLink, Check, Zap, Filter, Clock, Flame, ShieldAlert, Award, Play, MessageSquare, Send, Radio, Gift } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { getEventStatus, formatEventTime, getEventStatusBadge } from "@/lib/events"
import { useLiveEventTimer } from "@/hooks/use-events-state"

export interface GlobalEvent {
  id: string
  title: string
  description: string
  category: string
  banner_url: string
  location_type: string
  external_link?: string
  starts_at: string
  ends_at: string
  reward_coins: number
  badge_reward: string
  is_featured: boolean
  is_active: boolean
  rsvp_count?: number
  tags?: string[]
}

interface EventChatMessage {
  id: string
  user_name: string
  text: string
  timestamp: string
}

export function GlobalEventsHub() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { checkStatus } = useLiveEventTimer(15000)
  const [events, setEvents] = useState<GlobalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [rsvpedEventIds, setRsvpedEventIds] = useState<Set<string>>(new Set())
  const [detailEvent, setDetailEvent] = useState<GlobalEvent | null>(null)
  const [activeStageEvent, setActiveStageEvent] = useState<GlobalEvent | null>(null)

  // Live Stage State
  const [stageMessages, setStageMessages] = useState<EventChatMessage[]>([
    { id: "m1", user_name: "Alex Dev", text: "Excited for this hackathon launch! 🚀", timestamp: "Just now" },
    { id: "m2", user_name: "Sarah 3D", text: "Checking out the 3D lounge streams 🔥", timestamp: "1m ago" }
  ])
  const [chatInput, setChatInput] = useState("")
  const [stageReactions, setStageReactions] = useState<{ id: string; emoji: string; x: number }[]>([])
  const [rewardClaimed, setRewardClaimed] = useState(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/events")
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error("Failed to load events:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()

    if (supabase) {
      const channel = supabase
        .channel("global_events_live_updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "global_events" },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setEvents((prev) => [payload.new as GlobalEvent, ...prev])
            } else if (payload.eventType === "UPDATE") {
              setEvents((prev) =>
                prev.map((e) => (e.id === payload.new.id ? { ...e, ...(payload.new as GlobalEvent) } : e))
              )
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const handleSendStageMessage = () => {
    if (!chatInput.trim()) return
    const newMsg: EventChatMessage = {
      id: Date.now().toString(),
      user_name: user?.display_name || user?.username || "Attending Member",
      text: chatInput.trim(),
      timestamp: "Just now"
    }
    setStageMessages((prev) => [...prev, newMsg])
    setChatInput("")
    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
      }
    }, 100)
  }

  const handleSendReaction = (emoji: string) => {
    const rx = {
      id: Math.random().toString(),
      emoji,
      x: Math.random() * 80 + 10
    }
    setStageReactions((prev) => [...prev, rx])
    setTimeout(() => {
      setStageReactions((prev) => prev.filter((item) => item.id !== rx.id))
    }, 2500)
  }

  const handleClaimReward = (event: GlobalEvent) => {
    setRewardClaimed(true)
    toast({
      title: "Rewards Claimed! 🎁",
      description: `You earned +${event.reward_coins} Loop Coins and the "${event.badge_reward}" badge!`
    })
  }

  const handleRsvp = async (eventId: string, eventTitle: string) => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to RSVP for events.", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ event_id: eventId })
      })

      if (res.ok) {
        setRsvpedEventIds((prev) => new Set(prev).add(eventId))
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, rsvp_count: (e.rsvp_count || 0) + 1 } : e))
        )
        toast({
          title: "RSVP Confirmed! 🎉",
          description: `You are registered for "${eventTitle}". Notifications will remind you before it starts.`
        })
      }
    } catch (err) {
      console.error("RSVP error:", err)
    }
  }

  const categories = [
    { id: "all", name: "All Events" },
    { id: "Developer", name: "Developer's Den" },
    { id: "Creator", name: "Creator Zone" },
    { id: "Design", name: "3D & Design" },
    { id: "Gaming", name: "Gaming" },
    { id: "Music", name: "Music & Audio" },
  ]

  const filteredEvents = events.filter((e) => {
    const matchesCat = selectedCategory === "all" || e.category.toLowerCase() === selectedCategory.toLowerCase()
    const matchesSearch =
      !searchQuery ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Hero Banner Header */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-card border border-border p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300 font-semibold px-3 py-1 text-xs">
            <Flame className="mr-1.5 h-3.5 w-3.5 text-orange-400" /> Platform-Wide Events
          </Badge>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight sm:text-4xl">
            Loop App Global Events Hub
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Join official developer hackathons, content creator zone spotlights, 3D design showdowns, and live circle stages. Earn exclusive badges and Loop Coins!
          </p>
          {user?.is_admin && (
            <div className="pt-2">
              <Button asChild className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold shadow-lg hover:brightness-110">
                <Link href="/loopadmin?tab=events">
                  <Zap className="mr-2 h-4 w-4" />
                  Admin: Create & Manage Global Events
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full text-xs transition ${
                selectedCategory === cat.id
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-foreground font-semibold"
                  : "border-border bg-muted text-muted-foreground hover:bg-white/10"
              }`}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-full border-white/10 bg-black/40 pl-9 text-xs text-foreground"
          />
        </div>
      </div>

      {/* Grid of Events */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading platform events...</div>
      ) : filteredEvents.length === 0 ? (
        <Card className="border-white/10 bg-white/[0.02] p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-slate-500" />
          <h3 className="mt-2 text-base font-semibold text-foreground">No events found</h3>
          <p className="text-xs text-muted-foreground">Try adjusting your category filter or search query.</p>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const hasRsvped = rsvpedEventIds.has(event.id)
            const currentStatus = checkStatus(event)
            const badgeConfig = getEventStatusBadge(currentStatus)
            const formattedTime = formatEventTime(event.starts_at, currentStatus)

            return (
              <Card
                key={event.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/90 transition-all hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/5"
              >
                {/* Banner Image */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                  <img
                    src={event.banner_url || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80"}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-black/30" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <Badge className={`${badgeConfig.className} text-xs px-2.5 py-0.5 flex items-center gap-1`}>
                      {badgeConfig.dot && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
                      {badgeConfig.label}
                    </Badge>
                    <Badge className="bg-cyan-500 text-black font-bold text-xs">{event.category}</Badge>
                    {event.is_featured && (
                      <Badge className="bg-amber-400 text-black font-bold text-xs flex items-center gap-1">
                        <Star className="h-3 w-3 fill-black" /> Featured
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Content */}
                <CardContent className="flex flex-1 flex-col justify-between p-5">
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-foreground group-hover:text-cyan-300 transition line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{event.description}</p>
                  </div>

                  <div className="mt-4 space-y-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 text-cyan-300">
                        <Video className="h-4 w-4" /> {event.location_type || "Virtual Stage"}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                        <Trophy className="h-4 w-4" /> {event.reward_coins} Coins
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-blue-400" /> {event.rsvp_count || 0} Attending
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground font-medium">
                        <Clock className="h-3.5 w-3.5 text-cyan-400" /> {formattedTime}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        onClick={() => {
                          if (!hasRsvped) handleRsvp(event.id, event.title)
                          setActiveStageEvent(event)
                          setRewardClaimed(false)
                        }}
                        className="rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-foreground hover:opacity-90 shadow-md shadow-cyan-500/20"
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5 fill-white" />
                        Enter Stage
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="rounded-full border-white/10 bg-white/5 text-xs text-muted-foreground hover:bg-white/10"
                      >
                        <Link href={`/events/${event.id}`}>
                          Details & Hub
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Interactive Live Event Stage Modal */}
      {activeStageEvent && (
        <Dialog open={Boolean(activeStageEvent)} onOpenChange={() => setActiveStageEvent(null)}>
          <DialogContent className="border-white/15 bg-card text-foreground max-w-4xl p-0 overflow-hidden">
            <div className="relative flex flex-col lg:flex-row h-[85vh] max-h-[700px]">

              {/* Left Column: Live Video/Audio Stage Canvas */}
              <div className="relative flex-1 bg-black flex flex-col justify-between p-4 overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
                {/* Header Overlay */}
                <div className="z-10 flex items-center justify-between bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
                    <Badge className="bg-red-500 text-foreground font-bold text-xs">LIVE BROADCAST</Badge>
                    <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-none">
                      {activeStageEvent.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-cyan-300 font-medium">
                    <Users className="h-4 w-4 text-cyan-400" />
                    <span>{(activeStageEvent.rsvp_count || 12) + 48} Watching Live</span>
                  </div>
                </div>

                {/* Floating Reactions overlay */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {stageReactions.map((rx) => (
                    <div
                      key={rx.id}
                      className="absolute bottom-16 text-3xl animate-bounce transition-all duration-1000"
                      style={{ left: `${rx.x}%` }}
                    >
                      {rx.emoji}
                    </div>
                  ))}
                </div>

                {/* Stage Screen Display */}
                <div className="my-auto text-center space-y-4 py-8">
                  {activeStageEvent.banner_url ? (
                    <div className="relative mx-auto max-w-lg overflow-hidden rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
                      <ProxyImg src={activeStageEvent.banner_url} alt="Stage" className="w-full h-56 object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex items-end justify-center p-4">
                        <Button
                          onClick={() => handleClaimReward(activeStageEvent)}
                          disabled={rewardClaimed}
                          className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 font-bold text-black shadow-lg hover:brightness-110"
                        >
                          <Gift className="mr-2 h-4 w-4" />
                          {rewardClaimed ? "Reward Claimed! 🌟" : `Claim +${activeStageEvent.reward_coins} Loop Coins`}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-full border-4 border-cyan-500/30 bg-cyan-950/40 backdrop-blur">
                      <Radio className="h-20 w-20 text-cyan-400 animate-pulse" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h2 className="text-xl font-bold text-foreground">{activeStageEvent.title}</h2>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">{activeStageEvent.description}</p>
                  </div>
                </div>

                {/* Stage Controls Footer */}
                <div className="z-10 flex items-center justify-between bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2">
                    {["🔥", "👏", "🚀", "💎", "❤️"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleSendReaction(emoji)}
                        className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-lg transition active:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {activeStageEvent.external_link && (
                    <Button
                      asChild
                      size="sm"
                      className="rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400"
                    >
                      <a href={activeStageEvent.external_link} target="_blank" rel="noreferrer">
                        External Stream <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Right Column: Live Audience Chat */}
              <div className="w-full lg:w-80 bg-background flex flex-col justify-between p-4 border-t lg:border-t-0 border-white/10">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-cyan-400" /> Live Stage Chat
                  </h4>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px]">
                    Realtime Sync
                  </Badge>
                </div>

                {/* Chat Stream */}
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-3 my-3 pr-1 text-xs">
                  {stageMessages.map((msg) => (
                    <div key={msg.id} className="rounded-xl bg-white/[0.04] p-2.5 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-cyan-300">{msg.user_name}</span>
                        <span className="text-slate-500 text-[10px]">{msg.timestamp}</span>
                      </div>
                      <p className="text-slate-200 leading-normal">{msg.text}</p>
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <Input
                    placeholder="Chat with live audience..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendStageMessage()}
                    className="rounded-full border-white/10 bg-black/60 text-xs text-foreground"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendStageMessage}
                    className="rounded-full bg-cyan-500 text-black hover:bg-cyan-400 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Detail Dialog */}
      {detailEvent && (
        <Dialog open={Boolean(detailEvent)} onOpenChange={() => setDetailEvent(null)}>
          <DialogContent className="border-white/15 bg-card text-foreground max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-cyan-300 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" /> {detailEvent.title}
              </DialogTitle>
            </DialogHeader>

            {detailEvent.banner_url && (
              <div className="h-44 w-full rounded-xl overflow-hidden bg-slate-900 my-2">
                <ProxyImg src={detailEvent.banner_url} alt={detailEvent.title} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="space-y-4 text-sm text-muted-foreground">
              <p className="leading-relaxed">{detailEvent.description}</p>

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Category & Location</span>
                  <span className="font-medium text-foreground">{detailEvent.category} • {detailEvent.location_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Rewards</span>
                  <span className="font-semibold text-amber-300">{detailEvent.reward_coins} Coins + Badge "{detailEvent.badge_reward}"</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Starts At</span>
                  <span className="font-medium text-slate-200">{new Date(detailEvent.starts_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Ends At</span>
                  <span className="font-medium text-slate-200">{new Date(detailEvent.ends_at).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setDetailEvent(null)}>Close</Button>
                <Button
                  onClick={() => {
                    handleRsvp(detailEvent.id, detailEvent.title)
                    setDetailEvent(null)
                  }}
                  className="bg-cyan-500 text-black hover:bg-cyan-400 font-semibold rounded-full px-6"
                >
                  Confirm RSVP
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
