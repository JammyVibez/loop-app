"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, Trophy, Users, Star, Video, Search, ExternalLink, Check, Sparkles, Filter, Clock, Flame, ShieldAlert, Award } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

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

export function GlobalEventsHub() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [events, setEvents] = useState<GlobalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [rsvpedEventIds, setRsvpedEventIds] = useState<Set<string>>(new Set())
  const [detailEvent, setDetailEvent] = useState<GlobalEvent | null>(null)

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
  }, [])

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
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/60 via-slate-900 to-violet-950/60 p-6 sm:p-8">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300 font-semibold px-3 py-1 text-xs">
            <Flame className="mr-1.5 h-3.5 w-3.5 text-orange-400" /> Platform-Wide Events
          </Badge>
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
            Loop App Global Events Hub
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            Join official developer hackathons, content creator zone spotlights, 3D design showdowns, and live circle stages. Earn exclusive badges and Loop Coins!
          </p>
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
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-full border-white/10 bg-black/40 pl-9 text-xs text-white"
          />
        </div>
      </div>

      {/* Grid of Events */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">Loading platform events...</div>
      ) : filteredEvents.length === 0 ? (
        <Card className="border-white/10 bg-white/[0.02] p-8 text-center">
          <Calendar className="mx-auto h-12 w-12 text-slate-500" />
          <h3 className="mt-2 text-base font-semibold text-white">No events found</h3>
          <p className="text-xs text-slate-400">Try adjusting your category filter or search query.</p>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const hasRsvped = rsvpedEventIds.has(event.id)
            return (
              <Card
                key={event.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#030712]/70 transition-all hover:border-cyan-500/40 hover:shadow-xl hover:shadow-cyan-500/5"
              >
                {/* Banner Image */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-900">
                  <img
                    src={event.banner_url || "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80"}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-black/30" />
                  <div className="absolute top-3 left-3 flex gap-2">
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
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">{event.description}</p>
                  </div>

                  <div className="mt-4 space-y-3 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5 text-cyan-300">
                        <Video className="h-4 w-4" /> {event.location_type || "Virtual Stage"}
                      </span>
                      <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                        <Trophy className="h-4 w-4" /> {event.reward_coins} Coins
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-blue-400" /> {event.rsvp_count || 0} Attending
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="h-3.5 w-3.5" /> {new Date(event.starts_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={() => handleRsvp(event.id, event.title)}
                        disabled={hasRsvped}
                        className={`flex-1 rounded-full text-xs font-semibold ${
                          hasRsvped
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 shadow-md shadow-cyan-500/20"
                        }`}
                      >
                        {hasRsvped ? (
                          <span className="flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5" /> Registered
                          </span>
                        ) : (
                          "RSVP & Join Event"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetailEvent(event)}
                        className="rounded-full border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail Dialog */}
      {detailEvent && (
        <Dialog open={Boolean(detailEvent)} onOpenChange={() => setDetailEvent(null)}>
          <DialogContent className="border-white/15 bg-[#090d16] text-white max-w-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-cyan-300 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" /> {detailEvent.title}
              </DialogTitle>
            </DialogHeader>

            {detailEvent.banner_url && (
              <div className="h-44 w-full rounded-xl overflow-hidden bg-slate-900 my-2">
                <img src={detailEvent.banner_url} alt={detailEvent.title} className="h-full w-full object-cover" />
              </div>
            )}

            <div className="space-y-4 text-sm text-slate-300">
              <p className="leading-relaxed">{detailEvent.description}</p>

              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Category & Location</span>
                  <span className="font-medium text-white">{detailEvent.category} • {detailEvent.location_type}</span>
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
