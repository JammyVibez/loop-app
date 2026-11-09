"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
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
  ArrowDown,
  ArrowUp,
  BarChart3,
  Coins,
  Copy,
  Megaphone,
  Pencil,
  Plus,
  Target,
  Trash2,
  UserPlus,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { ImagePlus, Link2, Loader2 } from "lucide-react"
import type { MissionStepConfig, SurveyQuestionConfig } from "@/lib/quests-v2"

/* ------------------------------------------------------------------ */

interface AdminQuest {
  id: string
  title: string
  description: string | null
  icon: string | null
  accent: string | null
  quest_type: "ad" | "survey" | "minigame" | "native"
  native_action: string | null
  minigame_kind: string | null
  target_value: number
  requirement_count: number
  cadence: "daily" | "weekly" | "seasonal"
  starts_at: string | null
  ends_at: string | null
  reward_coins: number
  reward_xp: number
  reward_item_id: string | null
  reward_item_name?: string | null
  reward_label?: string | null
  thumbnail_url?: string | null
  audience: string
  is_active: boolean
  sort_order: number
  status?: string
  quest_kind?: string
  banner_url?: string | null
  category?: string | null
  difficulty?: string | null
  est_minutes?: number | null
  sponsor_name?: string | null
  sponsor_url?: string | null
  cta_text?: string | null
  terms_text?: string | null
  featured?: boolean
  is_sponsored?: boolean
  auto_claim?: boolean
  video_url?: string | null
  video_seconds?: number | null
  collection_tag?: string | null
  mission_config?: MissionStepConfig[]
  survey_config?: SurveyQuestionConfig[]
  game_config?: { min_score?: number; max_attempts?: number }
  stats?: QuestStats
  total_views?: number
  total_starts?: number
}

interface QuestStats { completions: number; claims: number; coins_paid: number; xp_paid: number }

const EMPTY: Partial<AdminQuest> = {
  title: "",
  description: "",
  icon: "target",
  accent: "violet",
  quest_type: "native",
  native_action: "create_loop",
  minigame_kind: "trivia",
  target_value: 1,
  requirement_count: 1,
  cadence: "daily",
  reward_coins: 100,
  reward_xp: 50,
  reward_item_id: null,
  audience: "all",
  is_active: true,
  status: "draft",
  quest_kind: "simple",
  category: "community",
  difficulty: "easy",
  est_minutes: 5,
  banner_url: "",
  video_url: "",
  video_seconds: 30,
  cta_text: "Start quest",
  terms_text: "",
  sponsor_name: "",
  sponsor_url: "",
  collection_tag: "",
  featured: false,
  is_sponsored: false,
  auto_claim: false,
  mission_config: [],
  survey_config: [],
  game_config: {},
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  ad: { label: "Video", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  survey: { label: "Survey", cls: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
  minigame: { label: "Game", cls: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/30" },
  native: { label: "Activity", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/10 text-emerald-600",
  paused: "bg-amber-500/10 text-amber-600",
  archived: "bg-muted text-muted-foreground/60",
}

const NATIVE_ACTIONS = [
  "create_loop",
  "create_comment",
  "join_circle",
  "win_duel",
  "send_gift",
  "daily_checkin",
  "invite_friend",
]

const NATIVE_ACTION_LABELS: Record<string, string> = {
  create_loop: "Create a post",
  create_comment: "Comment on a post",
  join_circle: "Join a Circle",
  win_duel: "Win a Duel",
  send_gift: "Send a gift",
  daily_checkin: "Daily check-in",
  invite_friend: "Invite a friend",
}

const CATEGORIES = ["community", "discovery", "watch", "survey", "game", "sponsored", "creator", "seasonal"]

/**
 * Media field: paste any image/video URL, or upload from the device.
 * Uploads go through the shared VPS media service.
 */
function MediaUrlField({
  label,
  value,
  onChange,
  accept,
  uploadType,
  placeholder,
}: {
  label: string
  value: string
  onChange: (url: string) => void
  accept: string
  uploadType: "image" | "video"
  placeholder?: string
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const upload = async (file: File) => {
    if (!file) return
    setUploading(true)
    try {
      const token = (user as any)?.access_token
      const result = await uploadMediaFile(file, {
        type: uploadType,
        folder: "quest-media",
        authHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      })
      onChange(result.url)
      toast({ title: "Media uploaded" })
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
            e.target.value = ""
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          title="Upload from device"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </Button>
      </div>
      {value && uploadType === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Preview" className="mt-1 h-16 w-full rounded-lg border object-cover" />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function AdminQuestsPanel() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [quests, setQuests] = useState<AdminQuest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<AdminQuest>>(EMPTY)
  const [inviteUsernames, setInviteUsernames] = useState("")
  const [statsFor, setStatsFor] = useState<AdminQuest | null>(null)
  const [statsData, setStatsData] = useState<QuestStats | null>(null)
  const [responsesFor, setResponsesFor] = useState<AdminQuest | null>(null)
  const [responses, setResponses] = useState<{ answers: any[]; completion_ms: number | null; created_at: string }[]>([])
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
    setEditing(q ? { ...q, target_value: q.requirement_count ?? q.target_value ?? 1 } : { ...EMPTY })
    setInviteUsernames("")
    setEditorOpen(true)
  }

  const save = async () => {
    if (!editing.title?.trim()) {
      toast({ title: "Title is required", variant: "destructive" })
      return
    }
    if (editing.quest_type === "survey" && !(editing.survey_config || []).length) {
      toast({ title: "Add at least one survey question", variant: "destructive" })
      return
    }
    if (editing.quest_kind === "mission" && (editing.mission_config || []).length < 2) {
      toast({ title: "Missions need at least 2 steps", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const isNew = !editing.id
      const res = await fetch(isNew ? "/api/admin/quests" : `/api/admin/quests/${editing.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: editing.title,
          description: editing.description || null,
          icon: editing.icon || null,
          accent: editing.accent || "violet",
          quest_type: editing.quest_type,
          quest_kind: editing.quest_kind || "simple",
          native_action: editing.quest_type === "native" ? editing.native_action : null,
          minigame_kind: editing.quest_type === "minigame" ? editing.minigame_kind : null,
          game_config: editing.quest_type === "minigame" ? editing.game_config || {} : {},
          requirement_count: Number(editing.requirement_count ?? editing.target_value) || 1,
          cadence: editing.cadence,
          starts_at: editing.starts_at || null,
          ends_at: editing.ends_at || null,
          reward_coins: Number(editing.reward_coins) || 0,
          reward_xp: Number(editing.reward_xp) || 0,
          reward_item_id: editing.reward_item_id || null,
          reward_label: editing.reward_label || null,
          audience: editing.audience || "all",
          status: editing.status || (editing.is_active ? "active" : "draft"),
          is_active: editing.is_active ?? true,
          sort_order: Number(editing.sort_order) || 0,
          banner_url: editing.banner_url || null,
          thumbnail_url: editing.thumbnail_url || null,
          category: editing.category || null,
          difficulty: editing.difficulty || "easy",
          est_minutes: editing.est_minutes ? Number(editing.est_minutes) : null,
          sponsor_name: editing.sponsor_name || null,
          sponsor_url: editing.sponsor_url || null,
          cta_text: editing.cta_text || null,
          terms_text: editing.terms_text || null,
          featured: Boolean(editing.featured),
          is_sponsored: Boolean(editing.is_sponsored),
          auto_claim: Boolean(editing.auto_claim),
          video_url: editing.video_url || null,
          video_seconds: editing.video_seconds ? Number(editing.video_seconds) : null,
          collection_tag: editing.collection_tag || null,
          mission_config: editing.mission_config || [],
          survey_config: editing.survey_config || [],
          invite_usernames: isNew
            ? inviteUsernames
                .split(/[,\s]+/)
                .map((value) => value.replace(/^@/, "").trim())
                .filter(Boolean)
            : [],
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

  const lifecycle = async (q: AdminQuest, action: string) => {
    try {
      const res = await fetch(`/api/admin/quests/${q.id}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      toast({ title: data.message || `Quest ${action}d`, description: q.title })
      load()
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" })
    }
  }

  const remove = async (q: AdminQuest) => {
    if (
      !(await confirmDialog({
        title: `Delete quest "${q.title}"?`,
        description: "Completion history is kept for analytics, but nobody can claim it again.",
        confirmLabel: "Delete quest",
        destructive: true,
      }))
    )
      return
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

  const showStats = (q: AdminQuest) => {
    setStatsFor(q)
    const s = q.stats || { completions: 0, claims: 0, coins_paid: 0, xp_paid: 0 }
    setStatsData({ ...s, claims: s.claims || s.completions })
  }

  const showResponses = async (q: AdminQuest) => {
    setResponsesFor(q)
    setResponses([])
    try {
      // Aggregated view only — individual free-text hidden behind count.
      const res = await fetch(`/api/admin/quests/survey-responses?quest_id=${q.id}`, { headers: getAuthHeaders() })
      const data = await res.json()
      if (res.ok) setResponses(data.responses || [])
    } catch { /* empty */ }
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

  /* ---------------- Mission step helpers ---------------- */
  const setSteps = (steps: MissionStepConfig[]) => setEditing((p) => ({ ...p, mission_config: steps }))
  const addStep = () =>
    setSteps([...(editing.mission_config || []), { title: "", verify: "manual", required: true }])
  const moveStep = (i: number, dir: -1 | 1) => {
    const steps = [...(editing.mission_config || [])]
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    setSteps(steps)
  }

  /* ---------------- Survey helpers ---------------- */
  const setQuestions = (qs: SurveyQuestionConfig[]) => setEditing((p) => ({ ...p, survey_config: qs }))
  const addQuestion = () =>
    setQuestions([...(editing.survey_config || []), { type: "single", question: "", options: ["", ""], required: true }])

  /* ---------------- Render ---------------- */

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
          <h3 className="text-base font-semibold">Quest Builder</h3>
          <p className="text-xs text-muted-foreground">
            Video, survey, game, community, creator, discovery, daily, weekly, mission, and sponsored quests.
          </p>
        </div>
        <Button size="sm" onClick={() => openEditor()}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New quest
        </Button>
      </div>

      {/* Daily earn caps */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">Daily earn caps (per user)</p>
          <p className="text-[11px] text-muted-foreground/70">Protects the coin economy from farming.</p>
        </div>
        <div className="w-24 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Coins</Label>
          <Input type="number" min={0} value={caps.quest_daily_coin_cap} onChange={(e) => setCaps((p) => ({ ...p, quest_daily_coin_cap: Number(e.target.value) }))} />
        </div>
        <div className="w-24 space-y-1">
          <Label className="text-[10px] text-muted-foreground">XP</Label>
          <Input type="number" min={0} value={caps.quest_daily_xp_cap} onChange={(e) => setCaps((p) => ({ ...p, quest_daily_xp_cap: Number(e.target.value) }))} />
        </div>
        <Button size="sm" variant="secondary" onClick={saveCaps} disabled={savingCaps}>
          {savingCaps ? <Spinner className="h-3.5 w-3.5" /> : "Save"}
        </Button>
      </div>

      {quests.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No quests yet. Create one to start rewarding engagement.
        </div>
      ) : (
        <div className="space-y-2">
          {quests.map((q) => {
            const tb = TYPE_BADGE[q.quest_type] || TYPE_BADGE.native
            const status = q.status || (q.is_active ? "active" : "draft")
            return (
              <div key={q.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground">
                  <Target className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{q.title}</span>
                    <Badge variant="outline" className={cn("text-[9px]", tb.cls)}>{tb.label}</Badge>
                    {q.quest_kind === "mission" && <Badge variant="outline" className="text-[9px] text-violet-500">Mission</Badge>}
                    <Badge variant="outline" className={cn("text-[9px]", STATUS_BADGE[status])}>{status}</Badge>
                    {q.featured && <Badge variant="outline" className="text-[9px] text-amber-500">Featured</Badge>}
                    {q.is_sponsored && <Badge variant="outline" className="text-[9px]">Sponsored</Badge>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {q.reward_coins > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600"><Coins className="h-3 w-3" /> {q.reward_coins.toLocaleString()}</span>
                    )}
                    {q.reward_xp > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-violet-500"><Zap className="h-3 w-3" /> {q.reward_xp.toLocaleString()} XP</span>
                    )}
                    {q.reward_item_name && <span className="text-pink-500">{q.reward_item_name}</span>}
                    <span>· {q.total_views || 0} views · {q.total_starts || 0} starts · {q.stats?.completions || 0} completions</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {status === "active" ? (
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => lifecycle(q, "pause")}>Pause</Button>
                  ) : status === "paused" || status === "draft" ? (
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-emerald-600" onClick={() => lifecycle(q, "publish")}>Publish</Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => lifecycle(q, "duplicate")} title="Duplicate">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => showStats(q)} title="Analytics">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </Button>
                  {q.quest_type === "survey" && (
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => showResponses(q)}>Responses</Button>
                  )}
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

      {/* ---------------- Editor dialog ---------------- */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit quest" : "New quest"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Basics */}
            <div className="grid grid-cols-[1fr_72px] gap-2">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={editing.title || ""} onChange={(e) => setEditing((p) => ({ ...p, title: e.target.value }))} placeholder="The Anime Weekend Mission" />
              </div>
              <div className="space-y-1">
                <Label>Accent</Label>
                <Select value={editing.accent || "violet"} onValueChange={(v) => setEditing((p) => ({ ...p, accent: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["violet", "amber", "emerald", "cyan", "rose", "sky"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editing.id && (
              <div className="space-y-1.5 rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
                <Label className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" /> Invite friends
                </Label>
                <Input
                  value={inviteUsernames}
                  onChange={(e) => setInviteUsernames(e.target.value)}
                  placeholder="@ada, @grace"
                />
                <p className="text-[10px] text-muted-foreground">
                  Each handle gets a notification pointing at this quest the moment it is created. Leave empty to
                  publish without invites.
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing((p) => ({ ...p, description: e.target.value }))} placeholder="Complete five steps across the community to earn the limited badge." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MediaUrlField
                label="Banner image"
                value={editing.banner_url || ""}
                onChange={(url) => setEditing((p) => ({ ...p, banner_url: url }))}
                accept="image/*"
                uploadType="image"
                placeholder="Paste URL or upload"
              />
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={editing.category || "community"} onValueChange={(v) => setEditing((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type + structure */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Quest type</Label>
                <Select value={editing.quest_type} onValueChange={(v) => setEditing((p) => ({ ...p, quest_type: v as AdminQuest["quest_type"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="native">Activity</SelectItem>
                    <SelectItem value="ad">Video</SelectItem>
                    <SelectItem value="survey">Survey</SelectItem>
                    <SelectItem value="minigame">Game</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Structure</Label>
                <Select value={editing.quest_kind || "simple"} onValueChange={(v) => setEditing((p) => ({ ...p, quest_kind: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Single quest</SelectItem>
                    <SelectItem value="mission">Mission (steps)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cadence</Label>
                <Select value={editing.cadence} onValueChange={(v) => setEditing((p) => ({ ...p, cadence: v as AdminQuest["cadence"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="seasonal">Limited time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type-specific config */}
            {editing.quest_type === "ad" && (
              <div className="space-y-2">
                <MediaUrlField
                  label="Quest video"
                  value={editing.video_url || ""}
                  onChange={(url) => setEditing((p) => ({ ...p, video_url: url }))}
                  accept="video/*"
                  uploadType="video"
                  placeholder="Paste URL or upload mp4 from device"
                />
                <div className="w-40 space-y-1">
                  <Label>Watch seconds required</Label>
                  <Input type="number" min={5} value={editing.video_seconds ?? 30} onChange={(e) => setEditing((p) => ({ ...p, video_seconds: Number(e.target.value) }))} />
                </div>
              </div>
            )}
            {editing.quest_type === "native" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Tracked action</Label>
                  <Select value={editing.native_action || "create_loop"} onValueChange={(v) => setEditing((p) => ({ ...p, native_action: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NATIVE_ACTIONS.map((a) => (
                        <SelectItem key={a} value={a}>{NATIVE_ACTION_LABELS[a] || a.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Times required</Label>
                  <Input type="number" min={1} value={editing.requirement_count ?? 1} onChange={(e) => setEditing((p) => ({ ...p, requirement_count: Number(e.target.value) }))} />
                </div>
                {editing.native_action === "invite_friend" && (
                  <p className="col-span-2 text-[11px] leading-relaxed text-muted-foreground">
                    Counts once per person who creates an account through this user&rsquo;s invite link
                    (Settings → Invite friends). Set &ldquo;Times required&rdquo; to the number of friends and the coin
                    reward below; each friend who signs up adds one step until the quest completes.
                  </p>
                )}
              </div>
            )}
            {editing.quest_type === "minigame" && (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label>Game</Label>
                  <Select value={editing.minigame_kind || "memory"} onValueChange={(v) => setEditing((p) => ({ ...p, minigame_kind: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="memory">Memory</SelectItem>
                      <SelectItem value="reaction">Reaction</SelectItem>
                      <SelectItem value="trivia">Trivia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Min score</Label>
                  <Input type="number" min={0} value={editing.game_config?.min_score ?? 0} onChange={(e) => setEditing((p) => ({ ...p, game_config: { ...p.game_config, min_score: Number(e.target.value) } }))} />
                </div>
                <div className="space-y-1">
                  <Label>Max attempts</Label>
                  <Input type="number" min={1} value={editing.game_config?.max_attempts ?? 3} onChange={(e) => setEditing((p) => ({ ...p, game_config: { ...p.game_config, max_attempts: Number(e.target.value) } }))} />
                </div>
              </div>
            )}

            {/* Mission builder */}
            {editing.quest_kind === "mission" && (
              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label>Mission steps</Label>
                  <Button size="sm" variant="outline" className="rounded-full" onClick={addStep}>
                    <Plus className="mr-1 h-3 w-3" /> Add step
                  </Button>
                </div>
                <div className="space-y-2">
                  {(editing.mission_config || []).map((step, i) => (
                    <div key={i} className="rounded-lg border bg-background/50 p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                        <Input
                          value={step.title}
                          onChange={(e) => setSteps((editing.mission_config || []).map((s, j) => (j === i ? { ...s, title: e.target.value } : s)))}
                          placeholder="Step title, e.g. Visit the Anime community"
                          className="h-8 text-sm"
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => moveStep(i, -1)} disabled={i === 0}><ArrowUp className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => moveStep(i, 1)} disabled={i === (editing.mission_config || []).length - 1}><ArrowDown className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500" onClick={() => setSteps((editing.mission_config || []).filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      <div className="mt-1.5 grid grid-cols-[1fr_90px] gap-1.5 pl-6">
                        <Input
                          value={step.description || ""}
                          onChange={(e) => setSteps((editing.mission_config || []).map((s, j) => (j === i ? { ...s, description: e.target.value } : s)))}
                          placeholder="Short description (optional)"
                          className="h-7 text-xs"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={step.reward_coins ?? 0}
                          onChange={(e) => setSteps((editing.mission_config || []).map((s, j) => (j === i ? { ...s, reward_coins: Number(e.target.value) } : s)))}
                          placeholder="Bonus"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                  {(editing.mission_config || []).length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">No steps yet — add the first one.</p>
                  )}
                </div>
              </div>
            )}

            {/* Survey builder */}
            {editing.quest_type === "survey" && (
              <div className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Label>Survey questions</Label>
                  <Button size="sm" variant="outline" className="rounded-full" onClick={addQuestion}>
                    <Plus className="mr-1 h-3 w-3" /> Add question
                  </Button>
                </div>
                <div className="space-y-2">
                  {(editing.survey_config || []).map((qq, i) => (
                    <div key={i} className="rounded-lg border bg-background/50 p-2">
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={qq.question}
                          onChange={(e) => setQuestions((editing.survey_config || []).map((s, j) => (j === i ? { ...s, question: e.target.value } : s)))}
                          placeholder={`Question ${i + 1}`}
                          className="h-8 text-sm"
                        />
                        <Select value={qq.type} onValueChange={(v) => setQuestions((editing.survey_config || []).map((s, j) => (j === i ? { ...s, type: v as SurveyQuestionConfig["type"], options: v === "single" || v === "multiple" ? (s.options || ["", ""]) : undefined } : s)))}>
                          <SelectTrigger className="h-8 w-28 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">Choice</SelectItem>
                            <SelectItem value="multiple">Multi</SelectItem>
                            <SelectItem value="rating">Rating 1-5</SelectItem>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="boolean">Yes/No</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-red-500" onClick={() => setQuestions((editing.survey_config || []).filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                      {(qq.type === "single" || qq.type === "multiple") && (
                        <div className="mt-1.5 space-y-1 pl-1">
                          {(qq.options || []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <Input
                                value={opt}
                                onChange={(e) => setQuestions((editing.survey_config || []).map((s, j) => (j === i ? { ...s, options: (s.options || []).map((o, k) => (k === oi ? e.target.value : o)) } : s)))}
                                placeholder={`Option ${oi + 1}`}
                                className="h-7 text-xs"
                              />
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={() => setQuestions((editing.survey_config || []).map((s, j) => (j === i ? { ...s, options: (s.options || []).filter((_, k) => k !== oi) } : s)))}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          ))}
                          <Button variant="ghost" size="sm" className="h-6 text-[11px] text-muted-foreground" onClick={() => setQuestions((editing.survey_config || []).map((s, j) => (j === i ? { ...s, options: [...(s.options || []), ""] } : s)))}>
                            <Plus className="mr-0.5 h-3 w-3" /> Option
                          </Button>
                        </div>
                      )}
                      <label className="mt-1 flex items-center gap-1.5 pl-1 text-[11px] text-muted-foreground">
                        <Switch checked={qq.required !== false} onCheckedChange={(v) => setQuestions((editing.survey_config || []).map((s, j) => (j === i ? { ...s, required: v } : s)))} />
                        Required
                      </label>
                    </div>
                  ))}
                  {(editing.survey_config || []).length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">No questions yet — add the first one.</p>
                  )}
                </div>
              </div>
            )}

            {/* Video/survey notice for mission-linked content */}
            {editing.quest_kind === "mission" && (editing.quest_type === "ad" || editing.quest_type === "survey") && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-muted-foreground">
                <Megaphone className="mr-1 inline h-3 w-3 text-amber-500" />
                Tip: create separate quests for embedded activities and reference them from mission steps; the mission itself tracks step completion.
              </div>
            )}

            {/* Schedule for limited-time */}
            {editing.cadence === "seasonal" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Starts at</Label>
                  <Input type="datetime-local" value={editing.starts_at ? editing.starts_at.slice(0, 16) : ""} onChange={(e) => setEditing((p) => ({ ...p, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
                </div>
                <div className="space-y-1">
                  <Label>Ends at</Label>
                  <Input type="datetime-local" value={editing.ends_at ? editing.ends_at.slice(0, 16) : ""} onChange={(e) => setEditing((p) => ({ ...p, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
                </div>
              </div>
            )}

            {/* Rewards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Coin reward</Label>
                <Input type="number" min={0} value={editing.reward_coins ?? 0} onChange={(e) => setEditing((p) => ({ ...p, reward_coins: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>XP reward</Label>
                <Input type="number" min={0} value={editing.reward_xp ?? 0} onChange={(e) => setEditing((p) => ({ ...p, reward_xp: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1">
                <Label>Est. minutes</Label>
                <Input type="number" min={0} value={editing.est_minutes ?? 5} onChange={(e) => setEditing((p) => ({ ...p, est_minutes: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Item reward (shop_items id)</Label>
                <Input value={editing.reward_item_id || ""} onChange={(e) => setEditing((p) => ({ ...p, reward_item_id: e.target.value || null }))} placeholder="e.g. 42" />
              </div>
              <div className="space-y-1">
                <Label>Collection tag (limited quests)</Label>
                <Input value={editing.collection_tag || ""} onChange={(e) => setEditing((p) => ({ ...p, collection_tag: e.target.value }))} placeholder="founding | seasonal | community" />
              </div>
            </div>

            {/* Difficulty + audience */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Difficulty</Label>
                <Select value={editing.difficulty || "easy"} onValueChange={(v) => setEditing((p) => ({ ...p, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Visibility</Label>
                <Select value={editing.audience || "all"} onValueChange={(v) => setEditing((p) => ({ ...p, audience: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    <SelectItem value="pro_only">Pro only</SelectItem>
                    <SelectItem value="org_only">Organizations</SelectItem>
                    <SelectItem value="new_users_only">New users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editing.status || "draft"} onValueChange={(v) => setEditing((p) => ({ ...p, status: v, is_active: v === "active" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sponsor */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Sponsor name</Label>
                <Input value={editing.sponsor_name || ""} onChange={(e) => setEditing((p) => ({ ...p, sponsor_name: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <Label>Sponsor URL</Label>
                <Input value={editing.sponsor_url || ""} onChange={(e) => setEditing((p) => ({ ...p, sponsor_url: e.target.value }))} placeholder="https://…" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Terms (shown on quest detail)</Label>
              <Textarea rows={2} value={editing.terms_text || ""} onChange={(e) => setEditing((p) => ({ ...p, terms_text: e.target.value }))} placeholder="Optional terms or eligibility notes" />
            </div>

            {/* Flags */}
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { key: "featured", label: "Featured", hint: "Hero placement" },
                { key: "is_sponsored", label: "Sponsored", hint: "Labeled to users" },
                { key: "auto_claim", label: "Auto-claim", hint: "No manual claim" },
              ].map((f) => (
                <div key={f.key} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div>
                    <Label className="text-xs">{f.label}</Label>
                    <p className="text-[10px] text-muted-foreground">{f.hint}</p>
                  </div>
                  <Switch
                    checked={Boolean((editing as any)[f.key])}
                    onCheckedChange={(v) => setEditing((p) => ({ ...p, [f.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner className="mr-1 h-3.5 w-3.5" /> : null}
              {editing.id ? "Save changes" : "Create quest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Analytics dialog ---------------- */}
      <Dialog open={!!statsFor} onOpenChange={(o) => !o && setStatsFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{statsFor?.title}</DialogTitle>
          </DialogHeader>
          {statsData && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Views", value: statsFor?.total_views || 0 },
                  { label: "Starts", value: statsFor?.total_starts || 0 },
                  { label: "Completions", value: statsData.completions },
                  { label: "Claims", value: statsData.claims },
                  { label: "Coins paid", value: statsData.coins_paid },
                  { label: "XP paid", value: statsData.xp_paid },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border p-3 text-center">
                    <div className="text-lg font-bold tabular-nums">{m.value.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground">{m.label}</div>
                  </div>
                ))}
              </div>
              {statsFor?.total_starts ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Completion rate (starts → completions)</span>
                    <span>{Math.round((statsData.completions / Math.max(1, statsFor.total_starts)) * 100)}%</span>
                  </div>
                  <Progress value={(statsData.completions / Math.max(1, statsFor.total_starts)) * 100} className="h-1.5" />
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------- Survey responses dialog ---------------- */}
      <Dialog open={!!responsesFor} onOpenChange={(o) => !o && setResponsesFor(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Survey responses — {responsesFor?.title}</DialogTitle>
          </DialogHeader>
          {responses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No responses yet.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {responses.length} response{responses.length === 1 ? "" : "s"} · avg completion{" "}
                {Math.round(responses.reduce((a, r) => a + (r.completion_ms || 0), 0) / responses.length / 1000)}s
              </p>
              {responses.slice(0, 20).map((r, i) => (
                <div key={i} className="rounded-lg border p-2.5 text-xs">
                  <p className="mb-1 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  <ol className="space-y-0.5">
                    {(r.answers || []).map((a: any) => (
                      <li key={a.index}>
                        <span className="font-medium">Q{Number(a.index) + 1}:</span>{" "}
                        {typeof a.value === "boolean" ? (a.value ? "Yes" : "No") : Array.isArray(a.value) ? a.value.map((v: number) => Number(v) + 1).join(", ") : String(a.value).slice(0, 140)}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
