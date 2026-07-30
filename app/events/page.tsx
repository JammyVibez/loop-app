"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Radio, Users, Plus, Clock, Tag, ExternalLink, RefreshCw, CheckCircle2, Sparkles, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface EventItem {
  id: string
  title: string
  description: string
  host_id: string
  host_name: string
  host_avatar: string
  category: string
  status: string
  start_time: string
  cover_image?: string
  participants_count: number
  is_live: boolean
}

const CATEGORIES = ["all", "Tech", "Gaming", "Music", "Workshops", "Community"]

export default function EventsPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState("all")

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Tech")
  const [isLiveNow, setIsLiveNow] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchEvents(true)

    // Supabase Real-Time Subscriptions for Events & Stages
    const channel = supabase
      .channel("realtime_events_hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        fetchEvents(false)
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "event_participants" }, () => {
        fetchEvents(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedCategory])

  const fetchEvents = async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const res = await fetch(`/api/events?category=${selectedCategory}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setEvents(data.events || [])
        }
      }
    } catch (err) {
      console.error("Failed to fetch events:", err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  const handleCreateEvent = async () => {
    if (!title.trim()) {
      toast({ title: "Error", description: "Event title is required", variant: "destructive" })
      return
    }

    setCreating(true)
    try {
      const token = user?.access_token
      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          is_live: isLiveNow,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setCreateOpen(false)
        setTitle("")
        setDescription("")
        fetchEvents()
        toast({
          title: "Event Created! 🚀",
          description: isLiveNow ? "Your event is live now!" : "Your event has been scheduled.",
        })
      } else {
        toast({
          title: "Failed to create event",
          description: data.error || "Could not save event",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({ title: "Error", description: "Unexpected error occurred", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Calendar className="w-7 h-7 text-indigo-500 shrink-0" />
            Events & Stage Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join live stream stages, tech workshops, and community roundtables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEvents(true)}
            disabled={loading}
            className="rounded-lg text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Host Event
          </Button>
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2 scrollbar-none">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
          <TabsList className="bg-muted/70 p-1 rounded-xl h-9">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="rounded-lg px-3 py-1 text-xs capitalize font-medium">
                {cat === "all" ? "All Events" : cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          Loading events stage...
        </div>
      ) : events.length === 0 ? (
        <Card className="border-border/60 bg-card/60 p-12 text-center space-y-4">
          <Radio className="w-12 h-12 mx-auto text-muted-foreground/40" />
          <div>
            <h3 className="text-base font-semibold">No active events found</h3>
            <p className="text-xs text-muted-foreground mt-1">Be the first to host an event for the community!</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="rounded-full text-xs">
            Host an Event Now
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((evt) => (
            <Card key={evt.id} className="group overflow-hidden border-border/60 bg-card hover:border-primary/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between">
              <div>
                {/* Cover Banner */}
                <div className="relative h-40 w-full overflow-hidden bg-muted">
                  <img
                    src={evt.cover_image || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80"}
                    alt={evt.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    {evt.is_live || evt.status === "live" ? (
                      <Badge className="bg-rose-500 hover:bg-rose-600 text-white text-xs px-2.5 py-0.5 animate-pulse flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white" />
                        LIVE STAGE
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-xs">
                        Upcoming
                      </Badge>
                    )}
                    <Badge variant="outline" className="bg-background/80 backdrop-blur-md text-xs font-medium">
                      {evt.category}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-5 space-y-3">
                  <h3 className="text-lg font-bold tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {evt.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {evt.description || "Join this exciting interactive session on Loop Stage."}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={evt.host_avatar || "/placeholder.svg"} />
                        <AvatarFallback>{evt.host_name?.charAt(0) || "H"}</AvatarFallback>
                      </Avatar>
                      <span className="text-foreground font-medium truncate max-w-[120px]">{evt.host_name}</span>
                    </div>

                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {evt.participants_count || 1}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(evt.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </div>

              <div className="p-4 pt-0">
                <Button asChild className="w-full rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90">
                  <Link href={`/events/${evt.id}`}>
                    Join Stage & Room <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Host Event Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Schedule Event Stage
            </DialogTitle>
            <DialogDescription className="text-xs">
              Host a live roundtable, workshop, or community broadcast on Loop.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="evt-title" className="text-xs font-semibold">Event Title</Label>
              <Input
                id="evt-title"
                placeholder="e.g. Next.js 15 & AI Engineering Roundtable"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div>
              <Label htmlFor="evt-category" className="text-xs font-semibold">Category</Label>
              <select
                id="evt-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full mt-1.5 px-3 py-2 bg-background border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CATEGORIES.filter((c) => c !== "all").map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="evt-desc" className="text-xs font-semibold">Description</Label>
              <Textarea
                id="evt-desc"
                placeholder="What will be discussed during this session?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1.5 rounded-xl resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/60">
              <div>
                <p className="text-xs font-semibold text-foreground">Start Live Immediately</p>
                <p className="text-[11px] text-muted-foreground">Open stage room right away</p>
              </div>
              <input
                type="checkbox"
                checked={isLiveNow}
                onChange={(e) => setIsLiveNow(e.target.checked)}
                className="w-4 h-4 text-primary rounded focus:ring-primary"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleCreateEvent}
              disabled={creating}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold"
            >
              {creating ? "Creating..." : "Publish Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
