"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BadgeCheck, CheckCircle2, Circle, Clock, Loader2, Lock, Send, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface VerifRequest {
  id: string | number
  verification_type: string
  status: string
  reason: string | null
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
}

const TYPES = [
  { value: "creator", label: "Creator", hint: "You make content people follow" },
  { value: "business", label: "Business / Brand", hint: "A company or brand presence" },
  { value: "public_figure", label: "Public figure", hint: "You're known outside Loop" },
  { value: "nonprofit", label: "Nonprofit", hint: "Registered organization" },
]

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending: { label: "Under review", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: Clock },
  approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  rejected: { label: "Not approved", cls: "bg-red-500/10 text-red-600 border-red-500/30", icon: XCircle },
}

export function VerificationSettings() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<{ is_verified: boolean; followers_count?: number; posts_count?: number; avatar_url?: string; display_name?: string } | null>(null)
  const [requests, setRequests] = useState<VerifRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ verificationType: "creator", realName: "", socialLinks: "", reason: "", documents: "" })

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [profileRes, reqRes] = await Promise.all([
        fetch("/api/users/me", { headers: getAuthHeader() }).catch(() => null),
        fetch("/api/verification/request", { headers: getAuthHeader() }),
      ])
      if (profileRes?.ok) {
        const data = await profileRes.json()
        setProfile(data.user || data.profile || data)
      }
      if (reqRes.ok) {
        const data = await reqRes.json()
        setRequests(data.requests || [])
      }
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeader])

  useEffect(() => {
    load()
  }, [load])

  const pending = requests.find((r) => r.status === "pending")
  const latest = requests[0]

  // Smart eligibility checklist — mirrors what admins look for.
  const eligibility = useMemo(() => {
    const followers = Number(profile?.followers_count || 0)
    const posts = Number(profile?.posts_count || 0)
    return [
      { label: "Profile photo added", ok: Boolean(profile?.avatar_url) },
      { label: "Display name set", ok: Boolean(profile?.display_name) },
      { label: "At least 10 posts", ok: posts >= 10, detail: `${posts}/10` },
      { label: "Authentic presence (no impersonation reports)", ok: true },
      { label: "Not already verified", ok: !profile?.is_verified },
    ]
  }, [profile])

  const eligibleCount = eligibility.filter((e) => e.ok).length
  const canSubmit = !profile?.is_verified && !pending && eligibleCount >= 3

  const submit = async () => {
    if (!form.realName.trim() || !form.reason.trim()) {
      toast({ title: "Missing details", description: "Your real name and reason are required." })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/verification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          realName: form.realName.trim(),
          username: user?.user_metadata?.username || user?.email?.split("@")[0] || "",
          socialLinks: form.socialLinks.trim(),
          reason: form.reason.trim(),
          verificationType: form.verificationType,
          documents: form.documents.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Submit failed")
      toast({ title: "Request submitted", description: "The Loop team reviews requests in order. You'll be notified of the decision." })
      setForm({ verificationType: form.verificationType, realName: "", socialLinks: "", reason: "", documents: "" })
      load()
    } catch (err: any) {
      toast({ title: "Could not submit", description: err.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Current status */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            profile?.is_verified ? "bg-sky-500/10" : "bg-muted",
          )}>
            <BadgeCheck className={cn("h-5 w-5", profile?.is_verified ? "text-sky-500" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {profile?.is_verified ? "Your account is verified" : "Get verified on Loop"}
            </p>
            <p className="text-sm text-muted-foreground">
              {profile?.is_verified
                ? "The checkmark shows next to your name everywhere on Loop."
                : "Verification confirms you are who you say you are. Verified accounts get a checkmark next to their name across the app."}
            </p>
          </div>
        </div>
      </div>

      {/* Pending / latest decision */}
      {pending && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <Clock className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold">Request under review</p>
            <p className="text-xs text-muted-foreground">
              Submitted {new Date(pending.created_at).toLocaleDateString()} · you'll get a notification when it's decided.
            </p>
          </div>
        </div>
      )}
      {!pending && latest?.status === "rejected" && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-600">
            <XCircle className="h-4 w-4" /> Previous request wasn't approved
          </p>
          {latest.admin_notes && <p className="mt-1 text-xs text-muted-foreground">Reviewer note: {latest.admin_notes}</p>}
          <p className="mt-1 text-xs text-muted-foreground">You can submit a new request below.</p>
        </div>
      )}

      {/* Eligibility checklist */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Before you request</p>
          <Badge variant={eligibleCount >= 3 ? "secondary" : "outline"} className="rounded-full text-[10px]">
            {eligibleCount}/{eligibility.length} ready
          </Badge>
        </div>
        <ul className="space-y-1.5">
          {eligibility.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              {item.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}
              <span className={cn(item.ok ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
              {item.detail && <span className="ml-auto text-xs text-muted-foreground">{item.detail}</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Request form */}
      {profile?.is_verified ? null : pending ? null : (
        <div className={cn("rounded-2xl border bg-card p-4", !canSubmit && "opacity-90")}>
          <p className="mb-3 text-sm font-semibold">Request verification</p>
          {!canSubmit && (
            <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Build your presence first: add a photo, set your name, and post at least 10 times.
            </p>
          )}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Verification type</Label>
              <Select value={form.verificationType} onValueChange={(v) => setForm((p) => ({ ...p, verificationType: v }))} disabled={!canSubmit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label} — <span className="text-muted-foreground">{t.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vr-name">Real name <span className="text-red-500">*</span></Label>
                <Input
                  id="vr-name"
                  value={form.realName}
                  onChange={(e) => setForm((p) => ({ ...p, realName: e.target.value }))}
                  placeholder="Your legal or stage name"
                  disabled={!canSubmit}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vr-links">Social links</Label>
                <Input
                  id="vr-links"
                  value={form.socialLinks}
                  onChange={(e) => setForm((p) => ({ ...p, socialLinks: e.target.value }))}
                  placeholder="Instagram, YouTube, X…"
                  disabled={!canSubmit}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vr-reason">Why should you be verified? <span className="text-red-500">*</span></Label>
              <Textarea
                id="vr-reason"
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value.slice(0, 600) }))}
                placeholder="Tell the team who you are and where people follow you."
                disabled={!canSubmit}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vr-docs">Supporting link (optional)</Label>
              <Input
                id="vr-docs"
                value={form.documents}
                onChange={(e) => setForm((p) => ({ ...p, documents: e.target.value }))}
                placeholder="Link to press page, portfolio, or official site"
                disabled={!canSubmit}
              />
              <p className="text-[11px] text-muted-foreground">
                Don't upload ID documents here. The team may ask for proof through official channels if needed.
              </p>
            </div>
            <Button className="rounded-full" disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
              Submit request
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      {requests.length > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Request history</p>
          <div className="space-y-2">
            {requests.map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.pending
              const Icon = meta.icon
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium capitalize">{r.verification_type.replace("_", " ")} verification</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                      {r.reviewed_at ? ` · reviewed ${new Date(r.reviewed_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0 rounded-full text-[10px]", meta.cls)}>
                    {meta.label}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
