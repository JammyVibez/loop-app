"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/skeletons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart3,
  Coins,
  Gamepad2,
  Gift,
  Megaphone,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react"

/* ------------------------------------------------------------------ */

interface QuestStats { completions: number; claims: number; coins_paid: number; xp_paid: number }

interface AdminQuest {
  id: string
  title: string
  description: string | null
  icon: string | null
  quest_type: "ad" | "survey" | "minigame" | "native"
  native_action: string | null
  minigame_kind: string | null
  target_value: number
  cadence: "daily" | "weekly" | "seasonal"
  starts_at: string | null
  ends_at: string | null
  reward_coins: number
  reward_xp: number
  reward_item_id: string | null
  reward_item_name?: string | null
  audience: string
  is_active: boolean
  sort_order: number
  stats?: QuestStats
}

const EMPTY: Partial<AdminQuest> = {
  title: "",
  description: "",
  icon: "🎯",
  quest_type: "native",
  native_action: "create_loop",
  minigame_kind: null,
  target_value: 1,
  cadence: "daily",
  reward_coins: 100,
  reward_xp: 50,
  reward_item_id: null,
  audience: "all",
  is_active: true,
  sort_order: 0,
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  ad: { label: "Ad", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  survey: { label: "Survey", cls: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
  minigame: { label: "Mini-game", cls: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30" },
  native: { label: "Native", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
}

const NATIVE_ACTIONS = [
  "create_loop",
  "create_comment",
  "join_circle",
  "win_duel",
  "send_gift",
  "daily_checkin",
]

/* ------------------------------------------------------------------ */

export function AdminQuestsPanel() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [quests, setQuests] = useState<AdminQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<AdminQuest>>(EMPTY)
  const [statsFor, setStatsFor] = useState<AdminQuest | null>(null)
  const [statsData, setStatsData] = useState<QuestStats | null>(null)
  const [caps, setCaps] = useState<{ quest_daily_coin_cap: number; quest_daily_xp_cap: number }>({
    quest_daily_coin_cap: 2000,
    quest_daily_xp_cap: 1000,
  })
  const [savingCaps, setSavingCaps] = useState(false)

  const getAuthHeaders = useCallback((): HeadersInit => {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    if (user?.access_token) h.Authorization = `Bearer ${user.access_token}`
    return h
  }, [user?.access_token])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/quests", { headers: getAuthHeaders() })
      const data = await res.json()
      const statsMap: Record<string, QuestStats> = data.stats || {}
      const list: AdminQuest[] = Array.isArray(data.quests) ? data.quests : []
      setQuests(list.map((q) => ({ ...q, stats: statsMap[q.id] })))
      if (data.caps) {
        setCaps((prev) => ({
          ...prev,
          ...(data.caps.quest_daily_coin_cap != null ? { quest_daily_coin_cap: Number(data.caps.quest_daily_coin_cap) } : {}),
          ...(data.caps.quest_daily_xp_cap != null ? { quest_daily_xp_cap: Number(data.caps.quest_daily_xp_cap) } : {}),
        }))
      }
    } catch {
      toast({ title: "Failed to load quests", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, toast])

  useEffect(() => {
    load()
  }, [load])

  const openEditor = (q?: AdminQuest) => {
    setEditing(q ? { ...q } : { ...EMPTY })
    setEditorOpen(true)
  }

  const save = async () => {
    if (!editing.title?.trim()) {
      toast({ title: "Title is required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const isNew = !editing.id
      const res = await fetch(isNew ? "/api/admin/quests" : `/api/admin/quests/${editing.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: editing.title,
          description: editing.description || null,
          icon: editing.icon || null,
          quest_type: editing.quest_type,
          native_action: editing.quest_type === "native" ? editing.native_action : null,
          minigame_kind: editing.quest_type === "minigame" ? editing.minigame_kind : null,
          target_value: Number(editing.target_value) || 1,
          cadence: editing.cadence,
          starts_at: editing.starts_at || null,
          ends_at: editing.ends_at || null,
          reward_coins: Number(editing.reward_coins) || 0,
          reward_xp: Number(editing.reward_xp) || 0,
          reward_item_id: editing.reward_item_id || null,
          audience: editing.audience || "all",
          is_active: editing.is_active ?? true,
          sort_order: Number(editing.sort_order) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast({ title: isNew ? "Quest created" : "Quest updated", description: data.quest?.title })
      setEditorOpen(false)
      load()
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (q: AdminQuest) => {
    try {
      const res = await fetch(`/api/admin/quests/${q.id}/toggle`, {
        method: "POST",
        headers: getAuthHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Toggle failed")
      setQuests((prev) => prev.map((x) => (x.id === q.id ? { ...x, is_active: !x.is_active } : x)))
      toast({ title: q.is_active ? "Quest disabled" : "Quest enabled", description: q.title })
    } catch (err: any) {
      toast({ title: "Toggle failed", description: err.message, variant: "destructive" })
    }
  }

  const remove = async (q: AdminQuest) => {
    if (!window.confirm(`Delete quest "${q.title}"? Completion history is kept for analytics.`)) return
    try {
      const res = await fetch(`/api/admin/quests/${q.id}`, { method: "DELETE", headers: getAuthHeaders() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast({ title: "Quest deleted", description: q.title })
      setQuests((prev) => prev.filter((x) => x.id !== q.id))
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    }
  }

  const showStats = async (q: AdminQuest) => {
    setStatsFor(q)
    const s = q.stats || { completions: 0, claims: 0, coins_paid: 0, xp_paid: 0 }
    setStatsData({ ...s, claims: s.claims || s.completions })
  }

  const saveCaps = async () => {
    setSavingCaps(true)
    try {
      const res = await fetch("/api/admin/quests", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          caps: {
            quest_daily_coin_cap: String(Number(caps.quest_daily_coin_cap) || 0),
            quest_daily_xp_cap: String(Number(caps.quest_daily_xp_cap) || 0),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast({ title: "Daily caps saved", description: "Applies to every user's quest earnings immediately." })
    } catch (err: any) {
      toast({ title: "Failed to save caps", description: err.message, variant: "destructive" })
    } finally {
      setSavingCaps(false)
    }
  }

  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Target className="h-4 w-4 text-violet-500" />
            Quests
            <Badge variant="secondary" className="text-[10px]">{quests.length}</Badge>
          </h3>
          <p className="text-xs text-muted-foreground">
            Rewarded engagement: ads, surveys, mini-games, and native actions.
          </p>
        </div>
        <Button size="sm" onClick={() => openEditor()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New quest
        </Button>
      </div>      {quests.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No quests yet. Create one to start rewarding engagement.
        </div>
      ) : (
        <div className="space-y-2">
          {quests.map((q) => {
            const tb = TYPE_BADGE[q.quest_type] || TYPE_BADGE.native
            return (
              <div
                key={q.id}
                className="flex items-center gap-3 rounded-xl border bg-card p-3"
              >
                <span className="text-xl">{q.icon || "🎯"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{q.title}</span>
                    <Badge variant="outline" className={`text-[9px] ${tb.cls}`}>{tb.label}</Badge>
                    <Badge variant="outline" className="text-[9px]">{q.cadence}</Badge>
                    {q.audience !== "all" && (
                      <Badge variant="outline" className="text-[9px] text-muted-foreground">{q.audience}</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {q.reward_coins > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600">
                        <Coins className="h-3 w-3" /> {q.reward_coins.toLocaleString()}
                      </span>
                    )}
                    {q.reward_xp > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-violet-500">
                        <Zap className="h-3 w-3" /> {q.reward_xp.toLocaleString()} XP
                      </span>
                    )}
                    {q.reward_item_name && (
                      <span className="inline-flex items-center gap-0.5 text-pink-500">
                        <Gift className="h-3 w-3" /> {q.reward_item_name}
                      </span>
                    )}
                    <span>· {q.is_active ? "Active" : "Disabled"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={q.is_active} onCheckedChange={() => toggle(q)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => showStats(q)} title="Analytics">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(q)} title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => remove(q)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Daily earn caps */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold">
              <Coins className="h-3.5 w-3.5 text-amber-500" /> Daily earn caps
            </h4>
            <p className="text-[11px] text-muted-foreground">
              Maximum coins/XP any user can earn from quests per day — protects the coin economy from farming.
            </p>
          </div>
          <div className="w-28 space-y-1">
            <Label htmlFor="cap-coins" className="text-[10px] text-muted-foreground">Coin cap</Label>
            <Input
              id="cap-coins"
              type="number"
              min={0}
              value={caps.quest_daily_coin_cap}
              onChange={(e) => setCaps((p) => ({ ...p, quest_daily_coin_cap: Number(e.target.value) }))}
            />
          </div>
          <div className="w-28 space-y-1">
            <Label htmlFor="cap-xp" className="text-[10px] text-muted-foreground">XP cap</Label>
            <Input
              id="cap-xp"
              type="number"
              min={0}
              value={caps.quest_daily_xp_cap}
              onChange={(e) => setCaps((p) => ({ ...p, quest_daily_xp_cap: Number(e.target.value) }))}
            />
          </div>
          <Button size="sm" variant="secondary" onClick={saveCaps} disabled={savingCaps}>
            {savingCaps ? <Spinner className="h-3.5 w-3.5" /> : "Save caps"}
          </Button>
        </div>
      </div>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit quest" : "New quest"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div className="space-y-1">
                <Label htmlFor="q-title">Title</Label>
                <Input
                  id="q-title"
                  value={editing.title || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Daily Trivia Champ"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="q-icon">Icon</Label>
                <Input
                  id="q-icon"
                  value={editing.icon || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, icon: e.target.value }))}
                  placeholder="🎯"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="q-desc">Description</Label>
              <Textarea
                id="q-desc"
                rows={2}
                value={editing.description || ""}
                onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))}
                placeholder="Answer 5 trivia questions correctly"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Quest type</Label>
                <Select
                  value={editing.quest_type}
                  onValueChange={(v) => setEditing((p) => ({ ...p, quest_type: v as AdminQuest["quest_type"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="native">Native action</SelectItem>
                    <SelectItem value="minigame">Mini-game</SelectItem>
                    <SelectItem value="ad">Rewarded ad</SelectItem>
                    <SelectItem value="survey">Survey / offerwall</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cadence</Label>
                <Select
                  value={editing.cadence}
                  onValueChange={(v) => setEditing((p) => ({ ...p, cadence: v as AdminQuest["cadence"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="seasonal">Seasonal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing.quest_type === "native" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Action</Label>
                  <Select
                    value={editing.native_action || "create_loop"}
                    onValueChange={(v) => setEditing((p) => ({ ...p, native_action: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NATIVE_ACTIONS.map((a) => (
                        <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-target">Times required</Label>
                  <Input
                    id="q-target"
                    type="number"
                    min={1}
                    value={editing.target_value ?? 1}
                    onChange={(e) => setEditing((p) => ({ ...p, target_value: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )}
            {editing.quest_type === "minigame" && (
              <div className="space-y-1">
                <Label>Mini-game</Label>
                <Select
                  value={editing.minigame_kind || "trivia"}
                  onValueChange={(v) => setEditing((p) => ({ ...p, minigame_kind: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trivia">Trivia</SelectItem>
                    <SelectItem value="reaction">Reaction time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(editing.quest_type === "ad" || editing.quest_type === "survey") && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-muted-foreground">
                <Megaphone className="mr-1 inline h-3 w-3 text-amber-500" />
                Rewards credit only after the network's signed server postback hits{" "}
                <code className="text-[10px]">/api/quests/{editing.quest_type === "ad" ? "ad" : "survey"}-callback</code>.
                Configure the postback URL + secret in your ad/offerwall dashboard.
              </div>
            )}
            {editing.cadence === "seasonal" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="q-start">Starts at</Label>
                  <Input
                    id="q-start"
                    type="datetime-local"
                    value={editing.starts_at ? editing.starts_at.slice(0, 16) : ""}
                    onChange={(e) => setEditing((p) => ({ ...p, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="q-end">Ends at</Label>
                  <Input
                    id="q-end"
                    type="datetime-local"
                    value={editing.ends_at ? editing.ends_at.slice(0, 16) : ""}
                    onChange={(e) => setEditing((p) => ({ ...p, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="q-coins">Coin reward</Label>
                <Input
                  id="q-coins"
                  type="number"
                  min={0}
                  value={editing.reward_coins ?? 0}
                  onChange={(e) => setEditing((p) => ({ ...p, reward_coins: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="q-xp">XP reward</Label>
                <Input
                  id="q-xp"
                  type="number"
                  min={0}
                  value={editing.reward_xp ?? 0}
                  onChange={(e) => setEditing((p) => ({ ...p, reward_xp: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="q-sort">Sort order</Label>
                <Input
                  id="q-sort"
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="q-item">Item reward (shop_items id, optional)</Label>
              <Input
                id="q-item"
                value={editing.reward_item_id || ""}
                onChange={(e) => setEditing((p) => ({ ...p, reward_item_id: e.target.value || null }))}
                placeholder="e.g. 42 — grants the item to inventory on claim"
              />
            </div>
            <div className="space-y-1">
              <Label>Visibility</Label>
              <Select
                value={editing.audience || "all"}
                onValueChange={(v) => setEditing((p) => ({ ...p, audience: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="pro_only">Pro subscribers only</SelectItem>
                  <SelectItem value="org_only">Organization members only</SelectItem>
                  <SelectItem value="new_users_only">New users (onboarding)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-2.5">
              <div>
                <Label htmlFor="q-active" className="text-sm">Active</Label>
                <p className="text-[11px] text-muted-foreground">Disabled quests are hidden from the board</p>
              </div>
              <Switch
                id="q-active"
                checked={editing.is_active ?? true}
                onCheckedChange={(v) => setEditing((p) => ({ ...p, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner className="mr-1 h-3.5 w-3.5" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
              {editing.id ? "Save changes" : "Create quest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics dialog */}
      <Dialog open={!!statsFor} onOpenChange={(o) => !o && setStatsFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-violet-500" />
              {statsFor?.title}
            </DialogTitle>
          </DialogHeader>
          {statsData && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xl font-bold">{statsData.completions.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">Completions</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xl font-bold">{statsData.claims.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">Claims</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xl font-bold text-amber-600">{statsData.coins_paid.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">Coins paid</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-xl font-bold text-violet-500">{statsData.xp_paid.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">XP paid</div>
                </div>
              </div>
              {statsData.completions > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Claim rate</span>
                    <span>{Math.round((statsData.claims / statsData.completions) * 100)}%</span>
                  </div>
                  <Progress value={(statsData.claims / statsData.completions) * 100} className="h-1.5" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
