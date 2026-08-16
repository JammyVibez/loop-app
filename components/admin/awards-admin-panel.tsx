"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Award, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AwardDef {
  id: string
  name: string
  description?: string | null
  emoji: string
  color: string
  is_active: boolean
  grant_count?: number
  created_at: string
}

interface Grant {
  id: string
  reason?: string | null
  created_at: string
  award?: { id: string; name: string; emoji: string; color: string } | any
  user?: { id: string; username: string; display_name: string; avatar_url?: string | null } | any
  awarded_by?: { id: string; username: string; display_name: string } | any
}

const COLOR_PRESETS = ["#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"]

export function AwardsAdminPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [awards, setAwards] = useState<AwardDef[]>([])
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)

  // create form
  const [form, setForm] = useState({ name: "", emoji: "🏆", color: "#f59e0b", description: "" })
  const [saving, setSaving] = useState(false)

  // grant form
  const [grantAwardId, setGrantAwardId] = useState("")
  const [grantUser, setGrantUser] = useState<any>(null)
  const [userSearch, setUserSearch] = useState("")
  const [userResults, setUserResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [reason, setReason] = useState("")
  const [granting, setGranting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/awards", { headers: getAuthHeader() })
      if (res.ok) {
        const data = await res.json()
        setAwards(data.awards || [])
        setGrants(data.recent_grants || [])
        setGrantAwardId((prev) => prev || (data.awards?.[0]?.id || ""))
      }
    } catch (error) {
      console.error("Failed to load awards:", error)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void load()
  }, [load])

  const createAward = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create award")
      setAwards((prev) => [data.award, ...prev])
      setForm({ name: "", emoji: "🏆", color: "#f59e0b", description: "" })
      toast({ title: "Award created", description: `"${data.award.name}" is ready to hand out.` })
    } catch (error: any) {
      toast({ title: "Couldn't create award", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleAward = async (award: AwardDef) => {
    const next = !award.is_active
    setAwards((prev) => prev.map((a) => (a.id === award.id ? { ...a, is_active: next } : a)))
    try {
      const res = await fetch(`/api/admin/awards?id=${award.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ is_active: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      toast({ title: next ? "Award activated" : "Award deactivated" })
    } catch (error: any) {
      setAwards((prev) => prev.map((a) => (a.id === award.id ? { ...a, is_active: !next } : a)))
      toast({ title: "Couldn't update", description: error.message || "Unknown error", variant: "destructive" })
    }
  }

  const deleteAward = async (award: AwardDef) => {
    if (!window.confirm(`Delete the "${award.name}" award? All grants of it will be removed too.`)) return
    try {
      const res = await fetch(`/api/admin/awards?id=${award.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      setAwards((prev) => prev.filter((a) => a.id !== award.id))
      toast({ title: "Award deleted" })
    } catch (error: any) {
      toast({ title: "Couldn't delete", description: error.message || "Unknown error", variant: "destructive" })
    }
  }

  const searchUsers = async (q: string) => {
    setUserSearch(q)
    if (!q.trim()) {
      setUserResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/users?q=${encodeURIComponent(q.trim())}&limit=8`, { headers: getAuthHeader() })
      if (res.ok) {
        const data = await res.json()
        setUserResults((data.users || []).filter((u: any) => u.id))
      }
    } catch {
      setUserResults([])
    } finally {
      setSearching(false)
    }
  }

  const grant = async () => {
    if (!grantAwardId || !grantUser || granting) return
    setGranting(true)
    try {
      const res = await fetch("/api/admin/awards", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: grantUser.id, award_id: grantAwardId, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to grant award")
      toast({ title: "Award granted 🎉", description: `${grantUser.display_name || grantUser.username} received it.` })
      setReason("")
      setGrantUser(null)
      setUserSearch("")
      setUserResults([])
      void load()
    } catch (error: any) {
      toast({ title: "Couldn't grant award", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setGranting(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading awards…</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Create award */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-amber-500" /> Create award
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createAward} className="space-y-3">
              <div className="flex gap-2">
                <div className="w-20">
                  <Label htmlFor="award-emoji">Emoji</Label>
                  <Input
                    id="award-emoji"
                    value={form.emoji}
                    onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                    className="text-center text-lg"
                    maxLength={8}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="award-name">Name</Label>
                  <Input
                    id="award-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Community Champion"
                  />
                </div>
              </div>
              <div>
                <Label>Color</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={cn(
                        "h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                        form.color === c ? "ring-foreground" : "ring-transparent hover:ring-border",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <Input
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="w-24"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="award-desc">Description</Label>
                <Textarea
                  id="award-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What does this award recognize?"
                  rows={2}
                  className="resize-none"
                />
              </div>
              <Button type="submit" disabled={saving || !form.name.trim()} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create award
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Grant award */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="h-4 w-4 text-emerald-500" /> Grant an award
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Award</Label>
              <Select value={grantAwardId} onValueChange={setGrantAwardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick an award" />
                </SelectTrigger>
                <SelectContent>
                  {awards.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.emoji} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>User</Label>
              {grantUser ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-lg">👤</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{grantUser.display_name || grantUser.username}</p>
                      <p className="truncate text-xs text-muted-foreground">@{grantUser.username}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setGrantUser(null); setUserResults([]); setUserSearch("") }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={userSearch}
                    onChange={(e) => void searchUsers(e.target.value)}
                    placeholder="Search by username or display name…"
                    className="pl-9"
                  />
                  {userResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => { setGrantUser(u); setUserResults([]); setUserSearch("") }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          <span className="h-6 w-6 shrink-0 rounded-full bg-muted" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{u.display_name || u.username}</span>
                            <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="grant-reason">Reason (optional)</Label>
              <Textarea
                id="grant-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this user getting the award?"
                rows={2}
                className="resize-none"
              />
            </div>

            <Button onClick={() => void grant()} disabled={!grantAwardId || !grantUser || granting} className="w-full">
              {granting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
              Grant award
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Award catalog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" /> Award catalog
            </span>
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {awards.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No awards yet — create your first one on the left.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {awards.map((award) => (
                <div
                  key={award.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5",
                    !award.is_active && "opacity-50",
                  )}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: `${award.color}1f`, color: award.color }}
                  >
                    {award.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{award.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {award.grant_count || 0} granted
                      {award.description ? ` · ${award.description}` : ""}
                    </p>
                  </div>
                  <Badge variant={award.is_active ? "default" : "outline"} className={cn(!award.is_active && "text-muted-foreground")}>
                    {award.is_active ? "Active" : "Hidden"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title={award.is_active ? "Deactivate" : "Activate"} onClick={() => void toggleAward(award)}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Delete" onClick={() => void deleteAward(award)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent grants */}
      {grants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent grants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grants.map((grant) => {
              const award = Array.isArray(grant.award) ? grant.award[0] : grant.award
              const user = Array.isArray(grant.user) ? grant.user[0] : grant.user
              const admin = Array.isArray(grant.awarded_by) ? grant.awarded_by[0] : grant.awarded_by
              return (
                <div key={grant.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
                  <span className="text-lg">{award?.emoji || "🏆"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">@{user?.username || "user"}</span>
                      <span className="text-muted-foreground"> received </span>
                      <span className="font-medium" style={{ color: award?.color }}>{award?.name}</span>
                      {grant.reason && <span className="text-muted-foreground"> — {grant.reason}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by @{admin?.username || "admin"} · {new Date(grant.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
