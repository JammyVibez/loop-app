"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Plus, Save, Trash2, Power, Check, Star, Shield, Crown, Zap, Search, Award } from "lucide-react"

interface BadgeRow {
  id: string
  name: string
  label?: string | null
  icon?: string | null
  colors: string[]
  description?: string | null
  is_active?: boolean
  created_at?: string
}

interface UserRow {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  badge_id?: string | null
}

const ICONS = [
  { value: "check", label: "Check", glyph: <Check className="h-3.5 w-3.5" /> },
  { value: "star", label: "Star", glyph: <Star className="h-3.5 w-3.5" /> },
  { value: "shield", label: "Shield", glyph: <Shield className="h-3.5 w-3.5" /> },
  { value: "crown", label: "Crown", glyph: <Crown className="h-3.5 w-3.5" /> },
  { value: "sparkle", label: "Sparkle", glyph: <Zap className="h-3.5 w-3.5" /> },
]

export function VerificationBadgesAdminPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [badges, setBadges] = useState<BadgeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<BadgeRow | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [label, setLabel] = useState("")
  const [icon, setIcon] = useState("check")
  const [colors, setColors] = useState<string[]>(["#0ea5e9", "#6366f1"])
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)

  // Assignment
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<UserRow[]>([])
  const [searching, setSearching] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadBadges = async () => {
    try {
      const res = await fetch("/api/admin/verification-badges", { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (data.success) setBadges(data.badges || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBadges()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setEditing(null)
    setName("")
    setLabel("")
    setIcon("check")
    setColors(["#0ea5e9", "#6366f1"])
    setDescription("")
    setIsActive(true)
  }

  const startEdit = (badge: BadgeRow) => {
    setEditing(badge)
    setName(badge.name)
    setLabel(badge.label || "")
    setIcon(badge.icon || "check")
    setColors(badge.colors?.length ? [...badge.colors] : ["#0ea5e9"])
    setDescription(badge.description || "")
    setIsActive(badge.is_active !== false)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload = { name, label, icon, colors, description, is_active: isActive }
      const res = editing
        ? await fetch(`/api/admin/verification-badges/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/verification-badges", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify(payload),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to save badge")
      toast({ title: editing ? "Badge updated" : "Badge created", description: name })
      resetForm()
      void loadBadges()
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (badge: BadgeRow) => {
    if (!confirm(`Delete "${badge.name}"? It will be removed from every user.`)) return
    try {
      const res = await fetch(`/api/admin/verification-badges/${badge.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      toast({ title: "Badge deleted" })
      if (editing?.id === badge.id) resetForm()
      void loadBadges()
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" })
    }
  }

  const handleToggleActive = async (badge: BadgeRow) => {
    try {
      const res = await fetch(`/api/admin/verification-badges/${badge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ is_active: !(badge.is_active !== false) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to toggle")
      void loadBadges()
    } catch (error: any) {
      toast({ title: "Toggle failed", description: error.message, variant: "destructive" })
    }
  }

  const searchUsers = async (q: string) => {
    if (!q.trim()) {
      setUsers([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=users`, { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      const found = Array.isArray(data.users)
        ? data.users
        : Array.isArray(data.results)
          ? data.results
          : []
      setUsers(found.slice(0, 8))
    } catch {
      setUsers([])
    } finally {
      setSearching(false)
    }
  }

  const handleAssign = async (user: UserRow, badgeId: string | null) => {
    setAssigningId(user.id)
    try {
      const res = await fetch("/api/admin/verification-badges/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: user.id, badge_id: badgeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Assign failed")
      toast({ title: badgeId ? "Checkmark assigned" : "Checkmark removed", description: user.display_name || user.username })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, badge_id: badgeId } : u)))
    } catch (error: any) {
      toast({ title: "Assign failed", description: error.message, variant: "destructive" })
    } finally {
      setAssigningId(null)
    }
  }

  const preview = (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white"
      style={
        colors.length > 1
          ? { backgroundImage: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }
          : { backgroundColor: colors[0] }
      }
    >
      {ICONS.find((i) => i.value === icon)?.glyph || <Check className="h-3 w-3" />}
    </span>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500">
          <Award className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold">Custom Checkmarks</h3>
          <p className="text-xs text-muted-foreground">
            Create unique checkmark badges (solid or gradient colors) and award them to any user.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create / edit form */}
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-4">
          <h4 className="text-sm font-bold">{editing ? `Edit: ${editing.name}` : "Create a checkmark badge"}</h4>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Badge name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Legend Creator" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Tooltip label (optional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Season 1 Legend" className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Icon</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ICONS.map((ic) => (
                  <button
                    key={ic.value}
                    type="button"
                    onClick={() => setIcon(ic.value)}
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                      icon === ic.value ? "border-violet-400 bg-violet-500/15 text-violet-500" : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                    title={ic.label}
                  >
                    {ic.glyph}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Colors — one = solid, two = gradient</Label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {colors.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 py-1.5">
                    <input
                      type="color"
                      value={c}
                      onChange={(e) => setColors((prev) => prev.map((col, i) => (i === idx ? e.target.value : col)))}
                      className="h-7 w-9 cursor-pointer rounded-md border border-border bg-transparent"
                    />
                    <Input
                      value={c}
                      onChange={(e) => setColors((prev) => prev.map((col, i) => (i === idx ? e.target.value : col)))}
                      className="h-7 w-24 rounded-md text-xs"
                    />
                  </div>
                ))}
                {colors.length < 2 && (
                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs" onClick={() => setColors((prev) => [...prev, "#6366f1"])}>
                    <Plus className="mr-1 h-3 w-3" /> Add gradient color
                  </Button>
                )}
                {colors.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 rounded-xl text-xs text-muted-foreground" onClick={() => setColors((prev) => prev.slice(0, 1))}>
                    Use solid
                  </Button>
                )}
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  Preview {preview}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 rounded-xl resize-none" placeholder="What makes this checkmark special?" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold">Active</p>
                <p className="text-[11px] text-muted-foreground">Inactive badges are hidden from users</p>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded text-violet-500 focus:ring-violet-500"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editing ? "Update badge" : "Create badge"}
              </Button>
              {editing && (
                <Button variant="outline" onClick={resetForm} className="rounded-xl">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Badge list + assignment */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card p-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading checkmarks…
            </div>
          ) : badges.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No checkmarks yet. Create your first one on the left.
            </div>
          ) : (
            <div className="space-y-2">
              {badges.map((badge) => {
                const glyph = ICONS.find((i) => i.value === badge.icon)?.glyph || <Check className="h-3 w-3" />
                return (
                  <div key={badge.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                      style={
                        (badge.colors || []).length > 1
                          ? { backgroundImage: `linear-gradient(135deg, ${badge.colors[0]}, ${badge.colors[1]})` }
                          : { backgroundColor: badge.colors?.[0] || "#0ea5e9" }
                      }
                    >
                      {glyph}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {badge.name}
                        {badge.label && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">{badge.label}</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {badge.is_active === false ? "Deactivated" : "Active"} · {(badge.colors || []).join(" → ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => handleToggleActive(badge)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" title={badge.is_active === false ? "Activate" : "Deactivate"}>
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => startEdit(badge)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" title="Edit">
                        <Save className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(badge)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Assign section */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h4 className="mb-2 text-sm font-bold">Assign to a user</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (searchTimer.current) clearTimeout(searchTimer.current)
                  searchTimer.current = setTimeout(() => void searchUsers(e.target.value), 300)
                }}
                placeholder="Search users by name or @username…"
                className="rounded-xl pl-9"
              />
            </div>
            <div className="mt-3 space-y-2">
              {searching && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                </p>
              )}
              {users.map((u) => {
                const current = u.badge_id || ""
                return (
                  <div key={u.id} className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (u.display_name || u.username || "U").charAt(0)
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{u.display_name || u.username}</p>
                      <p className="truncate text-[10px] text-muted-foreground">@{u.username}</p>
                    </div>
                    <select
                      value={current}
                      disabled={assigningId === u.id}
                      onChange={(e) => void handleAssign(u, e.target.value || null)}
                      className="h-8 max-w-[140px] rounded-lg border border-border bg-background px-2 text-xs"
                    >
                      <option value="">No checkmark</option>
                      {badges.filter((b) => b.is_active !== false).map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
              {!searching && users.length === 0 && searchQuery.trim() && (
                <p className="text-center text-xs text-muted-foreground py-2">No users found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
