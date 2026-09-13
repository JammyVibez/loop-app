"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { SPACE_TYPES } from "@/lib/community-categories"
import {
  Plus,
  Pencil,
  Archive,
  Trash2,
  Globe2,
  Lock,
  Shield,
  
  MessageSquare,
  Hash,
  Flame,
  Image as ImageIcon,
  BookOpen,
  Lightbulb,
  Palette,
  Swords,
  Trophy,
  Calendar,
  Users,
  Gamepad2,
  Compass,
  Library,
  Star,
  Vote,
  LayoutGrid,
  Crown,
  Home,
  Folder,
  Sparkles,
  Radio,
  Music,
  MapPin,
  Briefcase,
  Building2,
  HelpCircle,
  TrendingUp,
  Handshake,
  Camera,
  LayoutList,
  Wand2,
  Newspaper,
  ListOrdered,
  BarChart3,
  Clock,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Spinner } from "@/components/ui/skeletons"

function timeAgo(iso?: string | null) {
  if (!iso) return "No activity yet"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function WorldSpaces({ communityId, spaces, canModerate, onChanged }: { communityId: string; spaces: any[]; canModerate: boolean; onChanged: () => void }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState("discussion")
  const [icon, setIcon] = useState("hash")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState("members")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<any>(null)

  const openCreate = () => {
    setEditing(null)
    setName("")
    setType("discussion")
    setIcon("hash")
    setDescription("")
    setVisibility("members")
    setOpen(true)
  }

  const openEdit = (s: any) => {
    setEditing(s)
    setName(s.name)
    setType(s.type)
    setIcon(s.icon)
    setDescription(s.description || "")
    setVisibility(s.visibility)
    setOpen(true)
  }

  const save = async () => {
    if (!name.trim()) return setError("Space needs a name")
    setSaving(true)
    setError("")
    try {
      const res = await fetch(
        editing
          ? `/api/communities/${communityId}/spaces/${editing.id}`
          : `/api/communities/${communityId}/spaces`,
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type, icon, description, visibility }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setOpen(false)
      onChanged()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const archive = async (s: any) => {
    if (!confirm(`Archive "${s.name}"? Posts move to General.`)) return
    try {
      const res = await fetch(`/api/communities/${communityId}/spaces/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: true }),
      })
      if (!res.ok) throw new Error("Failed to archive")
      onChanged()
    } catch (e: any) {
      toast({
        title: "Couldn't archive space",
        description: e.message || "Please try again in a moment.",
        variant: "destructive",
      })
    }
  }

  const remove = async (s: any) => {
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/communities/${communityId}/spaces/${s.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      onChanged()
    } catch (e: any) {
      toast({
        title: "Couldn't delete space",
        description: e.message || "Please try again in a moment.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold">Spaces</h2>
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-500">{spaces.length}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">The rooms of your world — discussions, galleries, Q&A, chat and more.</p>
        </div>
        {canModerate && (
          <Button size="sm" className="shrink-0 rounded-full" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New space
          </Button>
        )}
      </div>

      {spaces.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-border p-12 text-center">
          <div className="pointer-events-none absolute -top-10 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15">
            <LayoutGrid className="h-6 w-6 text-indigo-400" />
          </div>
          <p className="relative mt-3 text-sm font-semibold">No spaces yet</p>
          <p className="relative mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
            {canModerate ? "Create the first space to structure this world." : "The community team is building the space structure."}
          </p>
          {canModerate && (
            <Button size="sm" className="relative mt-4 rounded-full" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create a space
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {spaces.map((s, i) => (
            <div key={s.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5">
              <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/0 blur-2xl transition-all duration-300 group-hover:bg-indigo-500/10" />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 via-fuchsia-500/10 to-cyan-500/20 shadow-inner">
                    <SpaceIcon icon={s.icon} className="h-5 w-5 text-indigo-400" />
                    <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-sm">{s.name}</p>
                    <Badge variant="secondary" className="mt-1 text-[9px] capitalize bg-muted/60">{s.type}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  {canModerate && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => archive(s)}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => remove(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {s.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 font-medium">
                  {s.visibility === "public" ? <Globe2 className="h-3 w-3 text-cyan-500" /> : s.visibility === "mods" ? <Shield className="h-3 w-3 text-amber-500" /> : <Lock className="h-3 w-3 text-muted-foreground" />}
                  {s.visibility}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 font-medium">
                  <MessageSquare className="h-3 w-3 text-indigo-500" /> {s.post_count ?? 0} posts
                </span>
                <span className="ml-auto flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(s.last_activity_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit "${editing.name}"` : "Create a space"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 rounded-xl" placeholder="e.g. Anime Discussion" maxLength={60} />
            </div>
            <div>
              <label className="text-xs font-medium">Type</label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto">
                {SPACE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition ${type === t.id ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:border-indigo-500/40"}`}
                  >
                    <SpaceIcon icon={t.icon} className={`h-4 w-4 ${type === t.id ? "text-indigo-500" : "text-muted-foreground"}`} />
                    <p className="text-[10px] font-semibold">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Visibility</label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {[
                  { id: "public", label: "Public" },
                  { id: "members", label: "Members" },
                  { id: "mods", label: "Moderators" },
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVisibility(v.id)}
                    className={`rounded-lg border p-2 text-center text-[11px] font-semibold transition ${visibility === v.id ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:border-indigo-500/40"}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 rounded-xl text-sm min-h-[70px]" placeholder="What is this space for?" maxLength={300} />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="rounded-full">
              {saving ? <Spinner className="h-3.5 w-3.5 mr-1.5" /> : null}
              {editing ? "Save changes" : "Create space"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Lucide icon per space icon-key (premium tiles; falls back to LayoutGrid). */
export function spaceIcon(icon: string): LucideIcon {
  const map: Record<string, LucideIcon> = {
    "message-circle": MessageSquare,
    "messages-square": MessageSquare,
    hash: Hash,
    flame: Flame,
    image: ImageIcon,
    "book-open": BookOpen,
    lightbulb: Lightbulb,
    palette: Palette,
    swords: Swords,
    trophy: Trophy,
    calendar: Calendar,
    users: Users,
    "gamepad-2": Gamepad2,
    compass: Compass,
    library: Library,
    star: Star,
    vote: Vote,
    "layout-grid": LayoutGrid,
    crown: Crown,
    home: Home,
    folder: Folder,
    sparkles: Sparkles,
    radio: Radio,
    "list-music": Music,
    "map-pin": MapPin,
    briefcase: Briefcase,
    "building-2": Building2,
    "help-circle": HelpCircle,
    "trending-up": TrendingUp,
    handshake: Handshake,
    camera: Camera,
    "layout-list": LayoutList,
    "wand-2": Wand2,
    newspaper: Newspaper,
    "list-ordered": ListOrdered,
    "bar-chart-3": BarChart3,
    clock: Clock,
  }
  return map[icon] || LayoutGrid
}

export function SpaceIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = spaceIcon(icon)
  return <Icon className={cn("h-5 w-5", className)} />
}

export function iconForSpace(icon: string) {
  const map: Record<string, string> = {
    "message-circle": "Chat",
    "messages-square": "Chat",
    hash: "Channel",
    flame: "Trending",
    image: "Media",
    "book-open": "Reading",
    lightbulb: "Ideas",
    palette: "Creative",
    swords: "Debate",
    trophy: "Challenges",
    calendar: "Events",
    users: "Members",
    "gamepad-2": "Gaming",
    compass: "Explore",
    library: "Library",
    star: "Featured",
    vote: "Polls",
    "layout-grid": "Grid",
    crown: "Leaderboard",
    home: "Home",
    folder: "Projects",
    sparkles: "Highlights",
    radio: "Live",
    "list-music": "Music",
    "map-pin": "Local",
    briefcase: "Work",
    "building-2": "Organization",
    "help-circle": "Q&A",
    "trending-up": "Trending",
    handshake: "Community",
    camera: "Photos",
    "layout-list": "List",
    "wand-2": "Creative",
    newspaper: "News",
    "list-ordered": "Rankings",
    "bar-chart-3": "Stats",
    clock: "Schedule",
  }
  return map[icon] || "Space"
}