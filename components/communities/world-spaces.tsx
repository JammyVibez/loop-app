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
  Loader2,
  GripVertical,
} from "lucide-react"

export function WorldSpaces({ communityId, spaces, canModerate, onChanged }: { communityId: string; spaces: any[]; canModerate: boolean; onChanged: () => void }) {
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
      alert(e.message)
    }
  }

  const remove = async (s: any) => {
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/communities/${communityId}/spaces/${s.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      onChanged()
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">Spaces</h2>
          <p className="text-xs text-muted-foreground">The rooms of your world — discussions, galleries, Q&A, chat and more.</p>
        </div>
        {canModerate && (
          <Button size="sm" className="rounded-full" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New space
          </Button>
        )}
      </div>

      {spaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <Globe2 className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold">No spaces yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canModerate ? "Create the first space to structure this world." : "The community team is building the space structure."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {spaces.map((s, i) => (
            <div key={s.id} className="group rounded-2xl border border-border bg-card p-4 hover:border-indigo-500/40 transition">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-fuchsia-500/15 text-lg">
                    {iconForSpace(s.icon)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{s.name}</p>
                    <Badge variant="secondary" className="mt-0.5 text-[9px] capitalize">{s.type}</Badge>
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
                {s.visibility === "public" ? <Globe2 className="h-3 w-3" /> : s.visibility === "mods" ? <Shield className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {s.visibility}
                <span className="ml-auto flex items-center gap-1"><GripVertical className="h-3 w-3" /> #{i + 1}</span>
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
                    className={`rounded-lg border p-2 text-center transition ${type === t.id ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:border-indigo-500/40"}`}
                  >
                    <p className="text-base">{iconForSpace(t.icon)}</p>
                    <p className="text-[10px] font-semibold mt-0.5">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Visibility</label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {[
                  { id: "public", label: "🌍 Public" },
                  { id: "members", label: "👥 Members" },
                  { id: "mods", label: "🛡️ Mods" },
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
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {editing ? "Save changes" : "Create space"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function iconForSpace(icon: string) {
  const map: Record<string, string> = {
    "message-circle": "💬",
    "messages-square": "💬",
    hash: "#️⃣",
    flame: "🔥",
    image: "🖼️",
    "book-open": "📖",
    lightbulb: "💡",
    palette: "🎨",
    swords: "⚔️",
    trophy: "🏆",
    calendar: "📅",
    users: "👥",
    "gamepad-2": "🎮",
    compass: "🧭",
    library: "📚",
    star: "⭐",
    vote: "🗳️",
    "layout-grid": "🔲",
    crown: "👑",
    home: "🏠",
    folder: "📁",
    sparkles: "✨",
    radio: "📻",
    "list-music": "🎵",
    "map-pin": "📍",
    briefcase: "💼",
    "building-2": "🏢",
    "help-circle": "❓",
    "trending-up": "📈",
    handshake: "🤝",
    camera: "📷",
    "layout-list": "📋",
    "wand-2": "🪄",
    newspaper: "📰",
    "list-ordered": "🔢",
    "bar-chart-3": "📊",
    clock: "⏰",
  }
  return map[icon] || "💬"
}