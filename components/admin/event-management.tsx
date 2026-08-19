"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Plus, Trophy, Users, Star, Trash2, Edit3, CheckCircle2, Globe, Video, Code, Image as ImageIcon, ExternalLink, Zap } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { getEventStatus, formatEventTime, getEventStatusBadge } from "@/lib/events"
import { useLiveEventTimer } from "@/hooks/use-events-state"

interface GlobalEvent {
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

const TEMPLATES = [
  {
    title: "Developers Den Hackathon 2026",
    description: "Build next-gen 3D web applications & smart loopapp.me extensions. Connect with top creators, share code, and compete for huge coin prizes!",
    category: "Developer",
    banner_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
    location_type: "Virtual Stage",
    reward_coins: 5000,
    badge_reward: "Dev Den Pioneer",
    tags: ["Developer", "Hackathon", "Coding"]
  },
  {
    title: "Content Creator Zone Spotlight",
    description: "Showcase your short videos, reels, and digital art to the global community! Gain viral visibility, live feedback, and exclusive rewards.",
    category: "Creator",
    banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
    location_type: "Creator Stage",
    reward_coins: 2500,
    badge_reward: "Master Creator",
    tags: ["Creators", "Reels", "Art"]
  },
  {
    title: "3D Art & World Design Championship",
    description: "Design custom 3D shader atmospheres, interactive canvas themes, and avatar cosmetics. Live community voting and prizes!",
    category: "Design",
    banner_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80",
    location_type: "3D Lounge",
    reward_coins: 3500,
    badge_reward: "3D Master Artist",
    tags: ["3D", "Avatars", "Shaders"]
  }
]

export function EventManagement() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { checkStatus } = useLiveEventTimer(15000)
  const [events, setEvents] = useState<GlobalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Developer",
    banner_url: "",
    location_type: "Virtual Stage",
    external_link: "",
    starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16),
    reward_coins: 1000,
    badge_reward: "Event Participant",
    is_featured: true,
    is_active: true,
    tags: "Developer, Event"
  })

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/events", { headers: getAuthHeader() })
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (err) {
      console.error("Error fetching admin events:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleApplyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setForm((prev) => ({
      ...prev,
      title: tpl.title,
      description: tpl.description,
      category: tpl.category,
      banner_url: tpl.banner_url,
      location_type: tpl.location_type,
      reward_coins: tpl.reward_coins,
      badge_reward: tpl.badge_reward,
      tags: tpl.tags.join(", ")
    }))
    setIsCreating(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.description.trim()) {
      toast({ title: "Validation Error", description: "Title and description are required.", variant: "destructive" })
      return
    }

    try {
      const payload = {
        ...form,
        reward_coins: Number(form.reward_coins),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean)
      }

      const url = editingEventId ? `/api/admin/events/${editingEventId}` : "/api/admin/events"
      const method = editingEventId ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save event")

      toast({
        title: editingEventId ? "Event Updated" : "Global Event Created!",
        description: `"${form.title}" is now published platform-wide.`
      })

      setIsCreating(false)
      setEditingEventId(null)
      fetchEvents()
    } catch (err: any) {
      toast({ title: "Save Error", description: err.message, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "DELETE",
        headers: getAuthHeader()
      })
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id))
        toast({ description: "Event removed." })
      }
    } catch (err) {
      console.error("Delete error:", err)
    }
  }

  const toggleFeatured = async (event: GlobalEvent) => {
    const nextFeatured = !event.is_featured
    try {
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, is_featured: nextFeatured } : e)))
      await fetch(`/api/admin/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ is_featured: nextFeatured })
      })
      toast({ description: `Event ${nextFeatured ? "featured" : "unfeatured"}.` })
    } catch (err) {
      console.error("Toggle featured error:", err)
    }
  }

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-[#0b1220] p-4 sm:p-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Calendar className="h-6 w-6 text-cyan-400" />
            Global Events & Hub Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Create and host platform-wide events like Developers Den, Content Creator Zone, and 3D Art Spotlights.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingEventId(null)
            setIsCreating(!isCreating)
          }}
          className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
        >
          <Plus className="mr-2 h-4 w-4" />
          {isCreating ? "Cancel Creation" : "Create Global Event"}
        </Button>
      </div>

      {/* Preset Templates */}
      {!isCreating && (
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              Quick Event Templates
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.title}
                onClick={() => handleApplyTemplate(tpl)}
                className="group text-left rounded-xl border border-white/10 bg-[#030712]/50 p-3 transition hover:border-cyan-500/50 hover:bg-white/5"
              >
                <Badge variant="outline" className="mb-2 border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  {tpl.category}
                </Badge>
                <h4 className="font-semibold text-white group-hover:text-cyan-300 text-sm line-clamp-1">{tpl.title}</h4>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{tpl.description}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-300 font-medium">
                  <Trophy className="h-3.5 w-3.5" />
                  {tpl.reward_coins} Coins + {tpl.badge_reward}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Event Creation Form */}
      {isCreating && (
        <Card className="border-cyan-500/30 bg-gradient-to-b from-[#0b1329] to-[#030712]">
          <CardHeader>
            <CardTitle className="text-lg text-cyan-300">
              {editingEventId ? "Edit Global Event" : "Create New App-Wide Event"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Events are highlighted to all users on feeds, dashboards, and the Global Events Hub.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Event Title</Label>
                  <Input
                    placeholder="e.g. Developers Den 2026"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Category</Label>
                  <Select value={form.category} onValueChange={(val) => setForm({ ...form, category: val })}>
                    <SelectTrigger className="bg-black/40 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Developer">Developer</SelectItem>
                      <SelectItem value="Creator">Creator</SelectItem>
                      <SelectItem value="Design">Design / 3D</SelectItem>
                      <SelectItem value="Gaming">Gaming</SelectItem>
                      <SelectItem value="Music">Music & Audio</SelectItem>
                      <SelectItem value="Community">Community</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Event Description</Label>
                <Textarea
                  placeholder="Describe the event goals, schedule, rules, and live stages..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-black/40 border-white/10 text-white min-h-[90px]"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Banner Image URL</Label>
                  <Input
                    placeholder="https://..."
                    value={form.banner_url}
                    onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Location / Stage Type</Label>
                  <Input
                    placeholder="e.g. Virtual Stage, Circle Room, Live Stream"
                    value={form.location_type}
                    onChange={(e) => setForm({ ...form, location_type: e.target.value })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">End Time</Label>
                  <Input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-slate-300">Reward Loop Coins</Label>
                  <Input
                    type="number"
                    value={form.reward_coins}
                    onChange={(e) => setForm({ ...form, reward_coins: Number(e.target.value) })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Reward Badge Name</Label>
                  <Input
                    placeholder="e.g. Dev Den Pioneer"
                    value={form.badge_reward}
                    onChange={(e) => setForm({ ...form, badge_reward: e.target.value })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-slate-300">Tags (comma separated)</Label>
                  <Input
                    placeholder="Developer, Hackathon, 3D"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_featured}
                    onCheckedChange={(checked) => setForm({ ...form, is_featured: checked })}
                  />
                  <Label className="text-sm text-slate-300">Feature on App Hero Banner</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                  />
                  <Label className="text-sm text-slate-300">Active / Published</Label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" type="button" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-cyan-500 text-black hover:bg-cyan-400 font-semibold px-6">
                  {editingEventId ? "Save Changes" : "Publish Global Event"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Events List */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
          const status = checkStatus(event)
          const badgeConfig = getEventStatusBadge(status)
          const formattedTime = formatEventTime(event.starts_at, status)

          return (
            <Card key={event.id} className="relative overflow-hidden border-white/10 bg-[#030712]/60 hover:border-white/20">
              {event.banner_url && (
                <div className="h-32 w-full overflow-hidden bg-slate-900 relative">
                  <img src={event.banner_url} alt={event.title} className="h-full w-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-black/40" />
                  <div className="absolute top-2 left-2 flex gap-1.5 items-center">
                    <Badge className={`${badgeConfig.className} text-[10px] px-2 py-0.5 flex items-center gap-1`}>
                      {badgeConfig.dot && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                      {badgeConfig.label}
                    </Badge>
                    <Badge className="bg-cyan-500/80 text-black font-semibold text-xs">{event.category}</Badge>
                    {event.is_featured && (
                      <Badge className="bg-amber-500 text-black font-semibold text-xs flex items-center gap-1">
                        <Star className="h-3 w-3 fill-black" /> Featured
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              <CardContent className="p-4">
                <h3 className="text-base font-bold text-white line-clamp-1">{event.title}</h3>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{event.description}</p>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1 text-cyan-300">
                    <Video className="h-3.5 w-3.5" /> {event.location_type || "Virtual Stage"}
                  </span>
                  <span className="flex items-center gap-1 text-amber-300 font-semibold">
                    <Trophy className="h-3.5 w-3.5" /> {event.reward_coins} Coins
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-blue-400" /> {event.rsvp_count || 0} RSVPs
                  </span>
                  <span className="text-cyan-400 font-medium">{formattedTime}</span>
                </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleFeatured(event)}
                  className="rounded-full text-xs border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <Star className={`mr-1 h-3.5 w-3.5 ${event.is_featured ? "fill-amber-400 text-amber-400" : ""}`} />
                  {event.is_featured ? "Featured" : "Feature"}
                </Button>

                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingEventId(event.id)
                      setForm({
                        title: event.title,
                        description: event.description,
                        category: event.category,
                        banner_url: event.banner_url || "",
                        location_type: event.location_type || "Virtual Stage",
                        external_link: event.external_link || "",
                        starts_at: new Date(event.starts_at).toISOString().slice(0, 16),
                        ends_at: new Date(event.ends_at).toISOString().slice(0, 16),
                        reward_coins: event.reward_coins,
                        badge_reward: event.badge_reward || "Event Participant",
                        is_featured: event.is_featured,
                        is_active: event.is_active,
                        tags: (event.tags || []).join(", ")
                      })
                      setIsCreating(true)
                    }}
                    className="h-8 w-8 text-slate-300 hover:text-cyan-300"
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(event.id)}
                    className="h-8 w-8 text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
    </div>
  )
}
