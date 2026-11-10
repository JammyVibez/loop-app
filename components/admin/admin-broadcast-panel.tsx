"use client"

/**
 * Admin Broadcast — premium campaign composer.
 *
 * Feels like a campaign manager, not a form: preset campaign cards auto-fill
 * every field, the composer sits beside a live email preview rendered from
 * the real send template, and delivery controls (audience, sample size,
 * email toggle) live in one delivery bar with a clear CTA.
 */

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { buildBroadcastEmailHtml } from "@/lib/broadcast-email"
import { BROADCAST_PRESETS, type BroadcastPreset } from "@/lib/broadcast-presets"
import { Spinner } from "@/components/ui/skeletons"
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Mail,
  Megaphone,
  Send,
  Shuffle,
  TrendingUp,
  Users,
} from "@/components/icons/lucide-compat"

type Scope = "all" | "random"

type BroadcastResult = {
  notified: number
  emailed: number
  targets: number
  emailEnabled: boolean
  emailSkipped: boolean
  scope: Scope
}

type SendKind = "announcement" | "trending"

const TRENDING_NUDGE = {
  title: "🔥 Check out what's trending on Loop",
  message:
    "A big conversation is happening right now — jump in before it wraps up!\n\nThe feed is moving fast: hot takes, fresh Duels, and creators on the rise.",
  previewText: "Your community is already in the app — see what's moving right now.",
  ctaLabel: "See what's happening",
}

export function AdminBroadcastPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [selectedPresetId, setSelectedPresetId] = useState<BroadcastPreset["id"] | null>(null)
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [previewText, setPreviewText] = useState("")
  const [ctaLabel, setCtaLabel] = useState("Open Loop")
  const [brandName, setBrandName] = useState("Loop")
  const [actionUrl, setActionUrl] = useState("")
  const [scope, setScope] = useState<Scope>("all")
  const [sampleSize, setSampleSize] = useState(100)
  const [sendEmail, setSendEmail] = useState(true)
  const [sending, setSending] = useState<SendKind | null>(null)
  const [result, setResult] = useState<BroadcastResult | null>(null)

  const applyPreset = (preset: BroadcastPreset) => {
    setSelectedPresetId(preset.id)
    setTitle(preset.subject)
    setPreviewText(preset.preview)
    setCtaLabel(preset.cta)
    setActionUrl(preset.actionUrl)
    setMessage(preset.body)
  }

  const clearSelection = () => setSelectedPresetId(null)

  const canSend = Boolean(title.trim() && message.trim()) && sending === null

  // Live preview renders the exact template the API will send.
  const emailPreviewHtml = useMemo(
    () =>
      buildBroadcastEmailHtml({
        title: title.trim() || "Your subject line appears here",
        message:
          message.trim() ||
          "Your message body will render live in this preview as you write…",
        previewText,
        ctaLabel,
        actionUrl,
        brandName,
      }),
    [title, message, previewText, ctaLabel, actionUrl, brandName],
  )

  const sendBroadcast = async (kind: SendKind) => {
    if (!canSend && kind === "announcement") return
    if (sending) return
    setSending(kind)
    setResult(null)

    const trending = kind === "trending"
    const payload = {
      title: trending ? TRENDING_NUDGE.title : title.trim(),
      message: trending ? TRENDING_NUDGE.message : message.trim(),
      preview_text: trending ? TRENDING_NUDGE.previewText : previewText.trim(),
      cta_label: trending ? TRENDING_NUDGE.ctaLabel : ctaLabel.trim() || "Open Loop",
      brand_name: brandName.trim() || "Loop",
      action_url: actionUrl.trim() || null,
      type: kind,
      preset: trending ? "trending_nudge" : selectedPresetId,
      scope,
      sample_size: sampleSize,
      send_email: sendEmail,
    }

    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Broadcast failed")

      setResult({
        notified: data.notified ?? 0,
        emailed: data.emailed ?? 0,
        targets: data.targets ?? 0,
        emailEnabled: Boolean(data.send_email),
        emailSkipped: sendEmail && !data.send_email,
        scope,
      })
      toast({
        title: trending ? "Trending nudge sent" : "Campaign sent",
        description: `${data.notified} users notified`,
      })
      if (!trending) {
        setTitle("")
        setMessage("")
        setPreviewText("")
        setCtaLabel("Open Loop")
        setActionUrl("")
        setSelectedPresetId(null)
      }
    } catch (error: any) {
      toast({ title: "Broadcast failed", description: error.message, variant: "destructive" })
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Campaign hero ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-[#0b1226] via-[#131c3f] to-[#312e81] p-6 text-white shadow-xl shadow-indigo-950/30 sm:p-8"
        aria-labelledby="broadcast-heading"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-10 h-56 w-56 rounded-full bg-blue-400/15 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
              <Megaphone className="h-4 w-4 text-indigo-300" aria-hidden="true" />
              Campaign Studio
            </div>
            <h2
              id="broadcast-heading"
              className="text-2xl font-extrabold tracking-tight sm:text-3xl"
            >
              Broadcast to the whole feed
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-indigo-100/80">
              Pick a campaign, tune the copy, watch the email preview update live, then ship it as
              an in-app notification — with email for members who opted in.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
              In-app + push
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
              Resend email batches
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* ── Composer ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-6">
          {/* Preset selector */}
          <Card className="overflow-hidden rounded-3xl border-border/70 bg-card/80 backdrop-blur">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm font-bold tracking-tight">Campaign preset</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Selecting one auto-fills every field — then edit anything before sending.
                  </p>
                </div>
                {selectedPresetId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full text-xs"
                    onClick={() => {
                      clearSelection()
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {BROADCAST_PRESETS.map((preset) => {
                  const active = selectedPresetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyPreset(preset)}
                      className={[
                        "group rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        active
                          ? "border-indigo-500 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 shadow-md shadow-indigo-500/10"
                          : "border-border/70 bg-background/40 hover:-translate-y-0.5 hover:border-indigo-400/60 hover:bg-indigo-500/5",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={[
                            "text-[13px] font-bold tracking-tight",
                            active ? "text-indigo-600 dark:text-indigo-300" : "text-foreground",
                          ].join(" ")}
                        >
                          {preset.label}
                        </span>
                        {active && (
                          <CheckCircle2
                            className="h-4 w-4 shrink-0 text-indigo-500"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                        {preset.subtitle}
                      </span>
                      <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {preset.tone}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Copy editor */}
          <Card className="rounded-3xl border-border/70 bg-card/80 backdrop-blur">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <Label className="text-sm font-bold tracking-tight">Campaign copy</Label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="b-title">Title / subject</Label>
                  <Input
                    id="b-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      clearSelection()
                    }}
                    placeholder="e.g. This conversation on Loop is blowing up 🌀"
                    maxLength={120}
                    aria-describedby="b-title-hint"
                  />
                  <p id="b-title-hint" className="text-xs text-muted-foreground">
                    Shown as the notification title and the email subject. {title.length}/120
                  </p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="b-preview">Preview text</Label>
                  <Input
                    id="b-preview"
                    value={previewText}
                    onChange={(e) => {
                      setPreviewText(e.target.value)
                      clearSelection()
                    }}
                    placeholder="Inbox preview line — the hook under the subject."
                    maxLength={240}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="b-cta">CTA label</Label>
                  <Input
                    id="b-cta"
                    value={ctaLabel}
                    onChange={(e) => {
                      setCtaLabel(e.target.value)
                      clearSelection()
                    }}
                    placeholder="Join the conversation"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="b-url">Action URL</Label>
                  <Input
                    id="b-url"
                    value={actionUrl}
                    onChange={(e) => {
                      setActionUrl(e.target.value)
                      clearSelection()
                    }}
                    placeholder="/explore  or  https://loopapp.me/explore"
                    inputMode="url"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="b-brand">Brand name</Label>
                  <Input
                    id="b-brand"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Loop"
                  />
                </div>

                <div className="hidden items-end pb-1 sm:flex" aria-hidden="true">
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Unsafe or relative links are normalized to loopapp.me before sending.
                  </span>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="b-msg">Message</Label>
                  <Textarea
                    id="b-msg"
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value)
                      clearSelection()
                    }}
                    rows={7}
                    placeholder="What should everyone know? Write it like a post — short lines, real energy."
                    className="resize-y leading-relaxed"
                    maxLength={2000}
                  />
                  <p className="text-right text-xs text-muted-foreground">{message.length}/2000</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery */}
          <Card className="rounded-3xl border-border/70 bg-card/80 backdrop-blur">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-bold tracking-tight">Delivery</Label>
                <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px]">
                  {scope === "all" ? "All users" : `Random ×${sampleSize}`}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium">Audience</legend>
                  <div className="flex gap-2" role="group" aria-label="Audience">
                    {(
                      [
                        { value: "all" as Scope, label: "All users", icon: Users },
                        { value: "random" as Scope, label: "Random sample", icon: Shuffle },
                      ]
                    ).map(({ value, label, icon: Icon }) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={scope === value ? "default" : "outline"}
                        className="rounded-full"
                        aria-pressed={scope === value}
                        onClick={() => setScope(value)}
                      >
                        <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-1.5">
                  <Label htmlFor="b-size">
                    {scope === "random" ? "Random sample size" : "Sample size (inactive)"}
                  </Label>
                  <Input
                    id="b-size"
                    type="number"
                    min={1}
                    max={500}
                    disabled={scope !== "random"}
                    value={sampleSize}
                    onChange={(e) => setSampleSize(Math.min(Math.max(Number(e.target.value) || 1, 1), 500))}
                    className="w-full sm:w-40"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                  <div>
                    <Label htmlFor="b-email" className="text-sm font-semibold cursor-pointer">
                      Send email
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Batches via Resend — only members with marketing emails enabled.
                    </p>
                  </div>
                </div>
                <Switch id="b-email" checked={sendEmail} onCheckedChange={setSendEmail} />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  disabled={!canSend || !title.trim() || !message.trim()}
                  onClick={() => void sendBroadcast("announcement")}
                  className="h-12 flex-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 font-bold shadow-lg shadow-indigo-600/25 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-600/40"
                >
                  {sending === "announcement" ? (
                    <Spinner className="mr-2 h-4 w-4" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Send announcement
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  disabled={sending !== null}
                  onClick={() => void sendBroadcast("trending")}
                  className="h-12 rounded-full border-indigo-400/50 px-6 font-bold hover:border-indigo-500 hover:bg-indigo-500/10"
                >
                  {sending === "trending" ? (
                    <Spinner className="mr-2 h-4 w-4" />
                  ) : (
                    <TrendingUp className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Trending nudge
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Result / status panel */}
          {result && (
            <Card
              role="status"
              className="overflow-hidden rounded-3xl border-emerald-500/30 bg-emerald-500/5"
            >
              <CardContent className="space-y-3 p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />
                  <p className="font-bold tracking-tight">
                    {result.scope === "all" ? "Campaign delivered" : "Sample campaign delivered"}
                  </p>
                  <Badge className="ml-auto rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                    Sent
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-3.5">
                    <p className="text-2xl font-extrabold tracking-tight">{result.notified}</p>
                    <p className="text-xs text-muted-foreground">In-app notifications</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-3.5">
                    <p className="text-2xl font-extrabold tracking-tight">{result.emailed}</p>
                    <p className="text-xs text-muted-foreground">Emails sent</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-3.5">
                    <p className="text-2xl font-extrabold tracking-tight">{result.targets}</p>
                    <p className="text-xs text-muted-foreground">Users targeted</p>
                  </div>
                </div>
                {result.emailSkipped && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Email skipped — <code className="rounded bg-amber-500/10 px-1 py-0.5">RESEND_API_KEY</code> is
                    not configured on this deployment. In-app notifications were still delivered.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Live email preview ───────────────────────────────────── */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" aria-label="Live email preview">
          <Card className="overflow-hidden rounded-3xl border-border/70 bg-card/80 backdrop-blur">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                  <Label className="text-sm font-bold tracking-tight">Live email preview</Label>
                </div>
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                  <span
                    className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                  Live
                </Badge>
              </div>

              {/* Mock inbox line */}
              <div className="rounded-2xl border border-border/70 bg-muted/40 px-3.5 py-3">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold">
                    {(brandName || "Loop").trim()} &lt;no-reply@loopapp.me&gt;
                  </span>
                  <span>now</span>
                </div>
                <p className="mt-1 truncate text-sm font-bold leading-snug">
                  {title.trim() || "Your subject line appears here"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {previewText.trim() || "Inbox preview text shows up right here as you type."}
                </p>
              </div>

              {/* The real send template, rendered live */}
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-slate-100 dark:bg-slate-950">
                <iframe
                  title="Broadcast email preview"
                  srcDoc={emailPreviewHtml}
                  sandbox=""
                  className="h-[560px] w-full border-0 bg-white"
                />
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Megaphone className="h-3.5 w-3.5 shrink-0 text-indigo-400" aria-hidden="true" />
                Rendered from the exact template used when sending.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
