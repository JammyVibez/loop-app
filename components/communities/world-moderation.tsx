"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { timeAgo } from "@/lib/community-engine"
import {
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  AlertTriangle,
  Trash2,
  ScrollText,
  Hourglass,
  Settings2,
  Check,
  Save,
} from "lucide-react"

export function WorldModeration({ communityId }: { communityId: string }) {
  const { user } = useAuth()
  const [reports, setReports] = useState<any[]>([])
  const [log, setLog] = useState<any[]>([])
  const [pending, setPending] = useState<any[]>([])
  const [role, setRole] = useState<string>("member")
  const [modSettings, setModSettings] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")
  const [durationHours, setDurationHours] = useState("24")
  const [acting, setActing] = useState<string | null>(null)
  const [tab, setTab] = useState<"reports" | "pending" | "log" | "settings">("reports")

  // Settings form
  const [approvalOn, setApprovalOn] = useState(false)
  const [blockedWords, setBlockedWords] = useState("")
  const [savingSettings, setSavingSettings] = useState(false)
  const [savedSettings, setSavedSettings] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/moderation`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setReports(data.reports || [])
      setLog(data.log || [])
      setPending(data.pending || [])
      if (data.role) setRole(data.role)
      const ms = data.settings?.moderation_settings || {}
      setModSettings(ms)
      setApprovalOn(Boolean(ms.post_approval))
      setBlockedWords(Array.isArray(ms.blocked_words) ? ms.blocked_words.join(", ") : "")
      if (ms.mute_duration_hours) setDurationHours(String(ms.mute_duration_hours))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  const saveSettings = async () => {
    setSavingSettings(true)
    setError("")
    setSavedSettings(false)
    try {
      const words = blockedWords
        .split(",")
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 100)
      const res = await fetch(`/api/communities/${communityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moderation_settings: {
            ...modSettings,
            post_approval: approvalOn,
            blocked_words: words,
            mute_duration_hours: Number(durationHours) || 24,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setSavedSettings(true)
      setTimeout(() => setSavedSettings(false), 2000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingSettings(false)
    }
  }

  const resolve = async (reportId: number, status: string) => {
    const res = await fetch(`/api/communities/${communityId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_report", report_id: reportId, resolution: status, note: reason }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Failed")
      return
    }
    setReason("")
    load()
  }

  const reviewPost = async (action: "approve_post" | "reject_post", post: any) => {
    if (action === "reject_post" && !reason.trim()) {
      setError("Add a reason so the author understands why it was rejected")
      return
    }
    setActing(`${action}-${post.id}`)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, post_id: post.id, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setReason("")
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const memberAction = async (action: string, target: any) => {
    if (!reason.trim() && action !== "unban") {
      setError(`Add a reason for ${action}`)
      return
    }
    setActing(`${action}-${target.user_id}`)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          user_id: target.user_id,
          reason,
          duration_hours: action === "mute" || action === "ban" ? Number(durationHours) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setReason("")
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const removePost = async (report: any) => {
    if (!confirm("Remove this post permanently?")) return
    const res = await fetch(`/api/communities/${communityId}/moderation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_post", post_id: report.target_id, reason: reason || "Removed by moderator" }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Failed")
      return
    }
    setReason("")
    load()
  }

  const openReports = reports.filter((r) => r.status === "open")
  const isAdmin = role === "owner" || role === "admin"
  const isMod = isAdmin || role === "moderator"

  const tabs: Array<{ id: "reports" | "pending" | "log" | "settings"; label: string; badge?: number }> = [
    { id: "reports", label: "Reports", badge: openReports.length },
    ...(isMod ? [{ id: "pending" as const, label: "Approval", badge: pending.length }] : []),
    { id: "log", label: "Log" },
    ...(isAdmin ? [{ id: "settings" as const, label: "Settings" }] : []),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-red-500" /> Moderation
          </h2>
          <p className="text-xs text-muted-foreground">Approval queue, reports, member actions and settings.</p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.id ? "bg-foreground text-background" : "border border-border bg-card"
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[9px] text-white">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : tab === "settings" ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-5 max-w-2xl">
          <h3 className="font-bold flex items-center gap-1.5">
            <Settings2 className="h-4 w-4 text-indigo-500" /> Moderation settings
          </h3>

          <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
            <div>
              <p className="text-sm font-semibold">Post approval mode</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                New posts from regular members go to the Approval tab instead of the feed until you approve them.
              </p>
            </div>
            <Switch checked={approvalOn} onCheckedChange={setApprovalOn} />
          </div>

          <div>
            <Label>Blocked words (comma separated)</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">
              Posts containing these words are rejected automatically — even if approval mode is off.
            </p>
            <Textarea
              value={blockedWords}
              onChange={(e) => setBlockedWords(e.target.value)}
              className="min-h-[80px] rounded-xl text-sm"
              placeholder="spammyword, anotherword"
            />
          </div>

          <div>
            <Label>Default mute / ban duration (hours)</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="max-w-[140px] rounded-xl"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          </div>

          <Button className="rounded-full" onClick={saveSettings} disabled={savingSettings}>
            {savingSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save settings
          </Button>
          {savedSettings && (
            <p className="text-xs font-medium text-emerald-500 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Moderation settings saved
            </p>
          )}
        </div>
      ) : tab === "pending" ? (
        pending.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Hourglass className="mx-auto h-6 w-6 text-emerald-500 mb-2" />
            <p className="text-sm font-semibold">Queue clear</p>
            <p className="text-xs text-muted-foreground mt-1">No posts waiting for approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={p.author?.avatar_url || ""} alt="" />
                    <AvatarFallback className="text-[10px]">
                      {(p.author?.display_name || p.author?.username || "U").slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{p.author?.display_name || p.author?.username}</p>
                    <p className="text-[10px] text-muted-foreground">
                      @{p.author?.username} · {timeAgo(p.created_at)} ·{" "}
                      {p.space_id ? (p.space_name || "space post") : "General"}
                    </p>
                  </div>
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                    <Hourglass className="h-2.5 w-2.5 mr-1" /> pending
                  </Badge>
                </div>
                <p className="mt-2.5 text-sm whitespace-pre-wrap rounded-xl bg-muted/40 p-3">{p.content}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Optional note to the author (required when rejecting)…"
                    className="min-h-[44px] rounded-xl text-xs flex-1 min-w-[200px]"
                  />
                  <Button
                    size="sm"
                    className="rounded-full bg-emerald-600 hover:bg-emerald-500 text-[11px]"
                    onClick={() => reviewPost("approve_post", p)}
                    disabled={acting === `approve_post-${p.id}`}
                  >
                    {acting === `approve_post-${p.id}` ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-full text-[11px]"
                    onClick={() => reviewPost("reject_post", p)}
                    disabled={acting === `reject_post-${p.id}`}
                  >
                    {acting === `reject_post-${p.id}` ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "reports" ? (
        reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500 mb-2" />
            <p className="text-sm font-semibold">All clear</p>
            <p className="text-xs text-muted-foreground mt-1">No reports in the queue.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className={`rounded-2xl border p-4 ${r.status === "open" ? "border-red-500/30 bg-red-500/[0.03]" : "border-border bg-card"}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-[9px] capitalize">{r.status}</Badge>
                      <span className="text-[11px] font-semibold">{r.target_type}</span>
                      {r.target_author && (
                        <span className="text-[11px] text-muted-foreground">by {r.target_author.display_name || r.target_author.username}</span>
                      )}
                      <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(r.created_at)}</span>
                    </div>
                    {r.reason && <p className="mt-1.5 text-xs"><strong>Reason:</strong> {r.reason}</p>}
                    {r.details && <p className="mt-0.5 text-[11px] text-muted-foreground">{r.details}</p>}
                    {r.reporter && <p className="mt-1 text-[10px] text-muted-foreground">Reported by {r.reporter.username}</p>}

                    {r.status === "open" && (
                      <div className="mt-3 space-y-2">
                        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Moderation note (optional)…" className="rounded-xl text-xs min-h-[50px]" />
                        <div className="flex flex-wrap gap-2">
                          {r.target_type === "post" && (
                            <Button size="sm" variant="destructive" className="rounded-full h-8 text-[11px]" onClick={() => removePost(r)}>
                              <Trash2 className="h-3 w-3 mr-1" /> Remove post
                            </Button>
                          )}
                          <Button size="sm" className="rounded-full h-8 text-[11px] bg-emerald-600 hover:bg-emerald-500" onClick={() => resolve(r.id, "resolved")}>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full h-8 text-[11px]" onClick={() => resolve(r.id, "dismissed")}>
                            <XCircle className="h-3 w-3 mr-1" /> Dismiss
                          </Button>
                          {r.target_author_id && (
                            <Button size="sm" variant="outline" className="rounded-full h-8 text-[11px] text-amber-600" onClick={() => memberAction("warn", { user_id: r.target_author_id })}>
                              <AlertTriangle className="h-3 w-3 mr-1" /> Warn author
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-2">
          {log.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <ScrollText className="mx-auto h-6 w-6 mb-2" />
              No moderation actions yet.
            </div>
          ) : (
            log.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={l.moderator?.avatar_url || ""} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {(l.moderator?.display_name || l.moderator?.username || "M").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <strong>{l.moderator?.display_name || l.moderator?.username || "System"}</strong>{" "}
                    <span className="capitalize text-muted-foreground">{l.action.replace("_", " ")}</span>{" "}
                    {l.target && <strong>@{l.target.username}</strong>}
                    {l.reason && <span className="text-muted-foreground"> — {l.reason}</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(l.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
