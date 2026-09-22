"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/skeletons"
import { cn } from "@/lib/utils"
import { formatNumber, timeAgo } from "@/lib/community-engine"
import {
  CalendarDays,
  Check,
  Clock,
  Gamepad2,
  Link2,
  MapPin,
  MessageSquare,
  MonitorPlay,
  Plus,
  Radio,
  Users,
} from "lucide-react"

interface CommunityEvent {
  id: number | string
  title: string
  description?: string | null
  event_type: string
  starts_at: string
  ends_at?: string | null
  location?: string | null
  event_link?: string | null
  max_participants?: number | null
  participant_count?: number | null
  is_attending?: boolean
  organizer?: {
    username?: string
    display_name?: string
    avatar_url?: string | null
  } | null
}

const EVENT_TYPES: Record<
  string,
  { label: string; icon: typeof Users; tint: string }
> = {
  discussion: { label: "Discussion", icon: MessageSquare, tint: "text-sky-500 bg-sky-500/10 border-sky-500/25" },
  voice_chat: { label: "Voice room", icon: Radio, tint: "text-emerald-500 bg-emerald-500/10 border-emerald-500/25" },
  screen_share: { label: "Screen share", icon: MonitorPlay, tint: "text-violet-500 bg-violet-500/10 border-violet-500/25" },
  game: { label: "Game night", icon: Gamepad2, tint: "text-amber-500 bg-amber-500/10 border-amber-500/25" },
}

function typeConfig(type: string) {
  return EVENT_TYPES[type] || EVENT_TYPES.discussion
}

/** "Fri, 24 Sep · 19:30" — reads better than a raw ISO string. */
function formatWhen(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

function isLive(ev: CommunityEvent) {
  const start = new Date(ev.starts_at).getTime()
  const end = ev.ends_at ? new Date(ev.ends_at).getTime() : start + 60 * 60 * 1000
  const now = Date.now()
  return now >= start && now <= end
}

export function WorldEvents({
  communityId,
  isMember,
  canManage,
}: {
  communityId: string
  isMember: boolean
  canManage: boolean
}) {
  const router = useRouter()
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [scope, setScope] = useState<"upcoming" | "past">("upcoming")
  const [events, setEvents] = useState<CommunityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [eventType, setEventType] = useState("discussion")
  const [startsAt, setStartsAt] = useState("")
  const [durationMins, setDurationMins] = useState("60")
  const [location, setLocation] = useState("")
  const [eventLink, setEventLink] = useState("")
  const [maxParticipants, setMaxParticipants] = useState("50")

  const load = useCallback(
    async (status: "upcoming" | "past") => {
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`/api/circles/${communityId}/events?status=${status}&limit=50`, {
          headers: user ? { ...getAuthHeader() } : undefined,
          cache: "no-store",
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load events")
        setEvents(data.events || [])
      } catch (e: any) {
        setError(e.message || "Failed to load events")
      } finally {
        setLoading(false)
      }
    },
    [communityId, user, getAuthHeader]
  )

  useEffect(() => {
    void load(scope)
  }, [load, scope])

  const toggleRsvp = async (ev: CommunityEvent) => {
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}?tab=events`)
      return
    }
    if (!isMember) {
      toast({ title: "Members only", description: "Join this community to RSVP to its events." })
      return
    }
    const key = String(ev.id)
    setBusyId(key)
    const going = Boolean(ev.is_attending)
    try {
      const res = await fetch(`/api/circles/${communityId}/events/${key}/participants`, {
        method: going ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not update your RSVP")
      setEvents((prev) =>
        prev.map((e) =>
          String(e.id) === key
            ? {
                ...e,
                is_attending: !going,
                participant_count: Math.max(0, Number(e.participant_count || 0) + (going ? -1 : 1)),
              }
            : e
        )
      )
      toast({
        title: going ? "RSVP cancelled" : "You're going",
        description: going ? ev.title : `Saved for ${formatWhen(ev.starts_at)}`,
      })
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const createEvent = async () => {
    if (!title.trim()) return setFormError("Give the event a title")
    if (!startsAt) return setFormError("Pick a date and time")
    const start = new Date(startsAt)
    if (Number.isNaN(start.getTime())) return setFormError("That date doesn't look right")
    const end = new Date(start.getTime() + Math.max(5, Number(durationMins) || 60) * 60000)

    setSaving(true)
    setFormError("")
    try {
      const res = await fetch(`/api/circles/${communityId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          event_type: eventType,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          location: location.trim() || null,
          event_link: eventLink.trim() || null,
          max_participants: Math.max(1, Number(maxParticipants) || 50),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to create event")
      setCreateOpen(false)
      setTitle("")
      setDescription("")
      setLocation("")
      setEventLink("")
      setStartsAt("")
      setScope("upcoming")
      if (data.event) setEvents((prev) => [data.event, ...prev].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)))
      toast({ title: "Event scheduled", description: data.event?.title || title.trim() })
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const { live, rest } = useMemo(() => {
    const live: CommunityEvent[] = []
    const rest: CommunityEvent[] = []
    for (const ev of events) (isLive(ev) ? live : rest).push(ev)
    return { live, rest }
  }, [events])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(["upcoming", "past"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors",
                scope === s
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {canManage ? (
          <Button size="sm" className="rounded-full" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New event
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-semibold">
            {scope === "upcoming" ? "Nothing scheduled yet" : "No past events"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {scope === "upcoming"
              ? canManage
                ? "Schedule the first event — a voice room, a watch party or a game night."
                : "When this community schedules something, it shows up here."
              : "Events move here once they've finished."}
          </p>
        </div>
      ) : (
        <>
          {live.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Happening now
              </p>
              {live.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  busy={busyId === String(ev.id)}
                  onToggle={toggleRsvp}
                />
              ))}
            </div>
          ) : null}

          {rest.length > 0 ? (
            <div className="space-y-3">
              {live.length > 0 ? (
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {scope === "upcoming" ? "Coming up" : "Archive"}
                </p>
              ) : null}
              {rest.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  busy={busyId === String(ev.id)}
                  onToggle={toggleRsvp}
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      {/* Create — owners, admins, moderators, or members granted event access */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule an event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title">Title</Label>
              <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday voice hangout" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-desc">Description</Label>
              <Textarea
                id="ev-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's happening, and who should come?"
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPES).map(([value, cfg]) => (
                      <SelectItem key={value} value={value}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Starts</Label>
                <Input
                  id="ev-start"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-duration">Duration (minutes)</Label>
                <Input
                  id="ev-duration"
                  type="number"
                  min={5}
                  value={durationMins}
                  onChange={(e) => setDurationMins(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-max">Max attendees</Label>
                <Input
                  id="ev-max"
                  type="number"
                  min={1}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-loc">Location</Label>
                <Input
                  id="ev-loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Voice room, #general…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-link">Link</Label>
                <Input
                  id="ev-link"
                  value={eventLink}
                  onChange={(e) => setEventLink(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            </div>
            {formError ? <p className="text-xs text-red-500">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createEvent} disabled={saving}>
              {saving ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EventCard({
  event,
  busy,
  onToggle,
}: {
  event: CommunityEvent
  busy: boolean
  onToggle: (ev: CommunityEvent) => void
}) {
  const cfg = typeConfig(event.event_type)
  const Icon = cfg.icon
  const live = isLive(event)
  const attending = Boolean(event.is_attending)
  const full =
    typeof event.max_participants === "number" &&
    Number(event.participant_count || 0) >= event.max_participants &&
    !attending

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-foreground/20">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              cfg.tint
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">{event.title}</h3>
              {live ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              ) : null}
              <Badge variant="outline" className={cn("border text-[10px]", cfg.tint)}>
                {cfg.label}
              </Badge>
            </div>
            {event.description ? (
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {event.description}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Clock className="h-3 w-3" />
                {formatWhen(event.starts_at)}
              </span>
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {live ? "now" : timeAgo(event.starts_at, true)}
              </span>
              {event.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {event.location}
                </span>
              ) : null}
              {event.event_link ? (
                <a
                  href={event.event_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-medium text-sky-500 hover:underline"
                >
                  <Link2 className="h-3 w-3" />
                  Join link
                </a>
              ) : null}
              {event.organizer ? (
                <span className="flex items-center gap-1.5">
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={event.organizer.avatar_url || ""} alt="" />
                    <AvatarFallback className="text-[8px]">
                      {(event.organizer.display_name || event.organizer.username || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {event.organizer.display_name || event.organizer.username}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
            <Users className="h-3 w-3" />
            {formatNumber(event.participant_count || 0)}
            {typeof event.max_participants === "number" && event.max_participants > 0
              ? ` / ${formatNumber(event.max_participants)}`
              : ""}
          </span>
          <Button
            size="sm"
            variant={attending ? "outline" : "default"}
            disabled={busy || full}
            onClick={() => onToggle(event)}
            className="rounded-full"
          >
            {busy ? (
              <Spinner className="mr-1.5 h-3.5 w-3.5" />
            ) : attending ? (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : null}
            {full ? "Full" : attending ? "Going" : "RSVP"}
          </Button>
        </div>
      </div>
    </div>
  )
}
