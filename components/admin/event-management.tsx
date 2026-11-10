"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/skeletons"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Trophy,
  Users,
  Video,
  Zap,
} from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { formatEventTime, getEventStatusBadge, type EventStatus } from "@/lib/events"
import { useLiveEventTimer } from "@/hooks/use-events-state"

interface GlobalEvent {
  id: string
  title: string
  description: string
  category: string
  banner_url: string | null
  location_type: string | null
  external_link?: string | null
  starts_at: string
  ends_at: string | null
  status?: string
  is_live?: boolean
  is_featured: boolean
  is_active: boolean
  reward_coins: number
  badge_reward?: string | null
  rsvp_count?: number
  tags?: string[]
}

type StatusFilter = "all" | EventStatus

const TEMPLATES = [
  {
    title: "Developers Den Hackathon 2026",
    description:
      "Build next-gen 3D web applications & smart loopapp.me extensions. Connect with top creators, share code, and compete for huge coin prizes!",
    category: "Developer",
    banner_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
    location_type: "Virtual Stage",
    reward_coins: 5000,
    badge_reward: "Dev Den Pioneer",
    tags: ["Developer", "Hackathon", "Coding"],
  },
  {
    title: "Content Creator Zone Spotlight",
    description:
      "Showcase your short videos, reels, and digital art to the global community! Gain viral visibility, live feedback, and exclusive rewards.",
    category: "Creator",
    banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
    location_type: "Creator Stage",
    reward_coins: 2500,
    badge_reward: "Master Creator",
    tags: ["Creators", "Trees", "Art"],
  },
  {
    title: "3D Art & World Design Championship",
    description:
      "Design custom 3D shader atmospheres, interactive canvas themes, and avatar cosmetics. Live community voting and prizes!",
    category: "Design",
    banner_url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&q=80",
    location_type: "3D Lounge",
    reward_coins: 3500,
    badge_reward: "3D Master Artist",
    tags: ["3D", "Avatars", "Shaders"],
  },
]

/** ISO timestamp → the local `YYYY-MM-DDTHH:mm` a datetime-local input wants. */
function toLocalInput(iso?: string | null) {
  const date = iso ? new Date(iso) : new Date(Date.now() + 86400000)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

const emptyForm = () => ({
  title: "",
  description: "",
  category: "Developer",
  banner_url: "",
  location_type: "Virtual Stage",
  external_link: "",
  starts_at: toLocalInput(),
  ends_at: toLocalInput(new Date(Date.now() + 86400000 * 3).toISOString()),
  reward_coins: 1000,
  badge_reward: "Event Participant",
  is_featured: true,
  is_active: true,
  tags: "Developer, Event",
})

export function EventManagement() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { checkStatus } = useLiveEventTimer(15000)

  const [events, setEvents] = useState<GlobalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [composerOpen, setComposerOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState<StatusFilter>("all")

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/events", { headers: getAuthHeader(), cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not load events")
      setEvents(data.events || [])
      setSetupRequired(Boolean(data.setupRequired))
      setLoadError(data.setupRequired ? null : data.error || null)
    } catch (err: any) {
      setLoadError(err.message || "Could not load events")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  const counts = useMemo(() => {
    const tally: Record<StatusFilter, number> = { all: events.length, live: 0, upcoming: 0, ended: 0 }
    for (const event of events) tally[checkStatus(event)] += 1
    return tally
  }, [events, checkStatus])

  const visibleEvents = useMemo(
    () => (filter === "all" ? events : events.filter((event) => checkStatus(event) === filter)),
    [events, filter, checkStatus],
  )

  const openComposer = (event?: GlobalEvent) => {
    if (event) {
      setEditingEventId(event.id)
      setForm({
        title: event.title,
        description: event.description || "",
        category: event.category || "General",
        banner_url: event.banner_url || "",
        location_type: event.location_type || "Virtual Stage",
        external_link: event.external_link || "",
        starts_at: toLocalInput(event.starts_at),
        ends_at: toLocalInput(event.ends_at),
        reward_coins: event.reward_coins ?? 0,
        badge_reward: event.badge_reward || "Event Participant",
        is_featured: event.is_featured,
        is_active: event.is_active,
        tags: (event.tags || []).join(", "),
      })
    } else {
      setEditingEventId(null)
      setForm(emptyForm())
    }
    setComposerOpen(true)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const closeComposer = () => {
    setComposerOpen(false)
    setEditingEventId(null)
    setForm(emptyForm())
  }

  const applyTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    setEditingEventId(null)
    setForm((prev) => ({
      ...prev,
      title: tpl.title,
      description: tpl.description,
      category: tpl.category,
      banner_url: tpl.banner_url,
      location_type: tpl.location_type,
      reward_coins: tpl.reward_coins,
      badge_reward: tpl.badge_reward,
      tags: tpl.tags.join(", "),
    }))
    setComposerOpen(true)
  }

  const handleSubmit = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault()
    if (!form.title.trim() || !form.description.trim()) {
      toast({ title: "Almost there", description: "An event needs a title and a description.", variant: "destructive" })
      return
    }
    if (new Date(form.ends_at).getTime() <= new Date(form.starts_at).getTime()) {
      toast({ title: "Check the schedule", description: "The end time has to be after the start time.", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        reward_coins: Number(form.reward_coins) || 0,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }
      const res = await fetch(editingEventId ? `/api/admin/events/${editingEventId}` : "/api/admin/events", {
        method: editingEventId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save the event")

      const saved: GlobalEvent = data.event
      setEvents((prev) => {
        const exists = prev.some((event) => event.id === saved.id)
        const next = exists ? prev.map((event) => (event.id === saved.id ? saved : event)) : [saved, ...prev]
        return next.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      })
      setSetupRequired(false)
      toast({
        title: editingEventId ? "Event updated" : "Event is live",
        description: data.message || `"${saved?.title || form.title}" is now showing across the app.`,
      })
      closeComposer()
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const patchEvent = async (event: GlobalEvent, patch: Partial<GlobalEvent>) => {
    setBusyId(event.id)
    // Optimistic — the row flips instantly, the API confirms right after.
    setEvents((prev) => prev.map((row) => (row.id === event.id ? { ...row, ...patch } : row)))
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Update failed")
      if (data.event) setEvents((prev) => prev.map((row) => (row.id === event.id ? { ...row, ...data.event } : row)))
      toast({
        title:
          patch.is_active === undefined
            ? data.event?.is_featured
              ? "Featured"
              : "Unfeatured"
            : data.event?.is_active
              ? "Event published"
              : "Event unpublished",
        description: event.title,
      })
    } catch (err: any) {
      setEvents((prev) => prev.map((row) => (row.id === event.id ? event : row)))
      toast({ title: "Update failed", description: err.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (event: GlobalEvent) => {
    if (
      !(await confirmDialog({
        title: `Delete "${event.title}"?`,
        description: "It disappears for everyone who RSVP'd and the event page stops working.",
        confirmLabel: "Delete event",
        destructive: true,
      }))
    )
      return

    setBusyId(event.id)
    try {
      const res = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE", headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      setEvents((prev) => prev.filter((row) => row.id !== event.id))
      toast({ title: "Event deleted", description: event.title })
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "upcoming", label: "Upcoming" },
    { key: "ended", label: "Ended" },
  ]

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Calendar className="h-5 w-5 text-primary" />
            Global events
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Platform-wide events that show up in the Events hub, on home and in search. Featured events get the hero
            slot.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => void fetchEvents()} aria-label="Refresh events">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => (composerOpen ? closeComposer() : openComposer())} className="rounded-full">
            <Plus className="mr-2 h-4 w-4" />
            {composerOpen ? "Close composer" : "New event"}
          </Button>
        </div>
      </div>

      {/* ── Setup / error notices ──────────────────────────────────────── */}
      {setupRequired && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Global events aren&apos;t set up in this database yet</p>
              <p className="text-muted-foreground">
                Apply <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">scripts/global-events-schema.sql</code>{" "}
                to create the <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">global_events</code> table.
                Until then events can&apos;t be saved or listed.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loadError && !setupRequired && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">Couldn&apos;t load events</p>
              <p className="text-muted-foreground">{loadError}</p>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void fetchEvents()}>
                Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Templates ─────────────────────────────────────────────────── */}
      {!composerOpen && !loading && (
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.title}
              type="button"
              onClick={() => applyTemplate(tpl)}
              className="group rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Zap className="h-3 w-3" />
                {tpl.category}
              </span>
              <h4 className="line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary">
                {tpl.title}
              </h4>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tpl.description}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-500">
                <Trophy className="h-3.5 w-3.5" />
                {tpl.reward_coins.toLocaleString()} coins · {tpl.badge_reward}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Composer ──────────────────────────────────────────────────── */}
      {composerOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editingEventId ? "Edit event" : "Create a global event"}</CardTitle>
            <CardDescription>
              Published events appear in the Events hub instantly and notify the community.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="event-title">Event title</Label>
                  <Input
                    id="event-title"
                    placeholder="e.g. Developers Den 2026"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Developer", "Creator", "Design", "Gaming", "Music", "Community", "General"].map((category) => (
                        <SelectItem key={category} value={category}>
                          {category === "Design" ? "Design / 3D" : category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  rows={3}
                  placeholder="What happens, who it's for, what people can win…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="event-banner">Banner image URL</Label>
                  <Input
                    id="event-banner"
                    placeholder="https://…"
                    value={form.banner_url}
                    onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-location">Location / stage</Label>
                  <Input
                    id="event-location"
                    placeholder="Virtual Stage, Circle room, Live stream…"
                    value={form.location_type}
                    onChange={(e) => setForm({ ...form, location_type: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-starts">Starts</Label>
                  <Input
                    id="event-starts"
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-ends">Ends</Label>
                  <Input
                    id="event-ends"
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-external">External link (optional)</Label>
                  <Input
                    id="event-external"
                    placeholder="https://…"
                    value={form.external_link}
                    onChange={(e) => setForm({ ...form, external_link: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="event-coins">Reward coins</Label>
                  <Input
                    id="event-coins"
                    type="number"
                    min={0}
                    value={form.reward_coins}
                    onChange={(e) => setForm({ ...form, reward_coins: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-badge">Reward badge</Label>
                  <Input
                    id="event-badge"
                    placeholder="e.g. Dev Den Pioneer"
                    value={form.badge_reward}
                    onChange={(e) => setForm({ ...form, badge_reward: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="event-tags">Tags</Label>
                  <Input
                    id="event-tags"
                    placeholder="Developer, Hackathon, 3D"
                    value={form.tags}
                    onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="event-featured"
                    checked={form.is_featured}
                    onCheckedChange={(checked) => setForm({ ...form, is_featured: checked })}
                  />
                  <Label htmlFor="event-featured" className="text-sm">
                    Feature in the hero slot
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="event-active"
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                  />
                  <Label htmlFor="event-active" className="text-sm">
                    Publish immediately
                  </Label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" className="rounded-full" onClick={closeComposer}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-full" disabled={saving}>
                  {saving ? <Spinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {editingEventId ? "Save changes" : "Publish event"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── List ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={filter === item.key ? "default" : "outline"}
            className="rounded-full text-xs"
            onClick={() => setFilter(item.key)}
          >
            {item.label}
            <span className="ml-1.5 text-[10px] opacity-70">{counts[item.key]}</span>
          </Button>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex justify-center py-12">
            <Spinner className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
      ) : visibleEvents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/60" />
            <div>
              <p className="font-medium">
                {events.length === 0 ? "No global events yet" : `No ${filter} events`}
              </p>
              <p className="text-sm text-muted-foreground">
                {events.length === 0
                  ? "Publish one and it shows up for everyone in the Events hub."
                  : "Try another filter."}
              </p>
            </div>
            {events.length === 0 && (
              <Button size="sm" className="rounded-full" onClick={() => openComposer()}>
                <Plus className="mr-2 h-4 w-4" />
                Create the first event
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleEvents.map((event) => {
            const status = checkStatus(event)
            const badge = getEventStatusBadge(status)
            const busy = busyId === event.id
            return (
              <Card key={event.id} className="flex flex-col overflow-hidden">
                {event.banner_url && (
                  <div className="relative h-32 w-full overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={event.banner_url}
                      alt={event.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2">
                      <Badge className={`${badge.className} text-[10px]`}>{badge.label}</Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {event.category}
                      </Badge>
                      {event.is_featured && (
                        <Badge className="gap-1 bg-amber-500 text-[10px] text-black">
                          <Star className="h-3 w-3 fill-black" /> Featured
                        </Badge>
                      )}
                      {!event.is_active && (
                        <Badge variant="outline" className="gap-1 bg-background/80 text-[10px]">
                          <EyeOff className="h-3 w-3" /> Unpublished
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 font-semibold">{event.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Video className="h-3.5 w-3.5" />
                      {event.location_type || "Virtual Stage"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-amber-500">
                      <Trophy className="h-3.5 w-3.5" />
                      {event.reward_coins.toLocaleString()} coins
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {event.rsvp_count || 0} RSVPs
                    </span>
                    <span className="font-medium text-primary">{formatEventTime(event.starts_at, status)}</span>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant={event.is_featured ? "secondary" : "outline"}
                      className="rounded-full text-xs"
                      disabled={busy}
                      onClick={() => void patchEvent(event, { is_featured: !event.is_featured })}
                    >
                      <Star className={`mr-1 h-3.5 w-3.5 ${event.is_featured ? "fill-amber-400 text-amber-400" : ""}`} />
                      {event.is_featured ? "Featured" : "Feature"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs"
                      disabled={busy}
                      onClick={() => void patchEvent(event, { is_active: !event.is_active })}
                    >
                      {event.is_active ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                      {event.is_active ? "Unpublish" : "Publish"}
                    </Button>
                    <div className="ml-auto flex items-center gap-1">
                      {event.external_link && (
                        <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                          <a href={event.external_link} target="_blank" rel="noopener noreferrer" aria-label="Open event link">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => openComposer(event)}
                        aria-label={`Edit ${event.title}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => void handleDelete(event)}
                        aria-label={`Delete ${event.title}`}
                      >
                        {busy ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && events.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Published events appear in the Events hub and are visible to everyone, signed in or not.
        </p>
      )}
    </div>
  )
}
