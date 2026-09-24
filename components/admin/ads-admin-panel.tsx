"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BarChart3,
  ExternalLink,
  Eye,
  Gauge,
  Image as ImageIcon,
  Megaphone,
  MousePointerClick,
  Pencil,
  Plus,
  Power,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/skeletons"
import { AdCard } from "@/components/ads/ad-card"
import { AD_FREQUENCY_DEFAULT, AD_SURFACES } from "@/lib/ads"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { cn } from "@/lib/utils"

interface AdSettings {
  enabled: boolean
  frequency_min: number
  frequency_max: number
  surfaces: Record<string, boolean>
}

interface AdRow {
  id: string
  sponsor_name: string
  headline: string
  description?: string | null
  media_url?: string | null
  media_type?: string | null
  link_url: string
  is_active: boolean
  impressions: number
  clicks: number
  created_at: string
}

const DEFAULT_SURFACES: Record<string, boolean> = AD_SURFACES.reduce(
  (acc, surface) => ({ ...acc, [surface.key]: true }),
  {},
)

const EMPTY_FORM = {
  sponsor_name: "",
  headline: "",
  description: "",
  media_url: "",
  media_type: "image",
  link_url: "",
}

/**
 * Pacing presets. The number is "organic posts between sponsored slots" — the
 * old default of 50–70 meant most sessions never reached a slot at all, which
 * read as "the ad system doesn't work". These give the admin an honest choice.
 */
const FREQUENCY_PRESETS = [
  { label: "Frequent", min: 5, max: 8, hint: "Visible on the first page of every feed" },
  {
    label: "Balanced",
    min: AD_FREQUENCY_DEFAULT.min,
    max: AD_FREQUENCY_DEFAULT.max,
    hint: "A slot roughly every screen or two",
  },
  { label: "Light", min: 25, max: 40, hint: "Occasional, premium-feeling placement" },
] as const

export function AdsAdminPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [ads, setAds] = useState<AdRow[]>([])
  const [settings, setSettings] = useState<AdSettings>({
    enabled: false,
    frequency_min: AD_FREQUENCY_DEFAULT.min,
    frequency_max: AD_FREQUENCY_DEFAULT.max,
    surfaces: DEFAULT_SURFACES,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const adFileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setLoadError(null)
      const res = await fetch("/api/admin/ads", { headers: { ...getAuthHeader() }, cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load ads")
      setAds(data.ads || [])
      setSettings({
        enabled: Boolean(data.settings?.enabled),
        frequency_min: Number(data.settings?.frequency_min ?? AD_FREQUENCY_DEFAULT.min),
        frequency_max: Number(data.settings?.frequency_max ?? AD_FREQUENCY_DEFAULT.max),
        // Merge over defaults so a placement added since the settings row was
        // written still shows up as a toggle instead of silently missing.
        surfaces: { ...DEFAULT_SURFACES, ...(data.settings?.surfaces || {}) },
      })
    } catch (error: any) {
      setLoadError(error.message || "Failed to load ads")
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void load()
  }, [load])

  const saveSettings = async (next: AdSettings, options?: { silent?: boolean }) => {
    setSaving(true)
    const previous = settings
    setSettings(next)
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ type: "settings", settings: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setSettings({
        enabled: Boolean(data.settings.enabled),
        frequency_min: Number(data.settings.frequency_min),
        frequency_max: Number(data.settings.frequency_max),
        surfaces: { ...DEFAULT_SURFACES, ...(data.settings.surfaces || {}) },
      })
      if (options?.silent) return
      toast({
        title: data.settings.enabled ? "Ads are live" : "Ads paused",
        description: `A sponsored slot every ${data.settings.frequency_min}–${data.settings.frequency_max} posts.`,
      })
    } catch (error: any) {
      setSettings(previous)
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const uploadAdMedia = async (file: File) => {
    setUploadingMedia(true)
    try {
      const type = file.type.startsWith("video") ? "video" : "image"
      const uploaded = await uploadMediaFile(file, { type, folder: "ads", authHeaders: getAuthHeader() })
      setForm((f) => ({ ...f, media_url: uploaded.url, media_type: type }))
      toast({ title: "Media attached", description: type === "video" ? "Video ready." : "Image ready." })
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Could not upload media", variant: "destructive" })
    } finally {
      setUploadingMedia(false)
      if (adFileRef.current) adFileRef.current.value = ""
    }
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const startEdit = (ad: AdRow) => {
    setEditingId(ad.id)
    setForm({
      sponsor_name: ad.sponsor_name,
      headline: ad.headline,
      description: ad.description || "",
      media_url: ad.media_url || "",
      media_type: ad.media_type || "image",
      link_url: ad.link_url,
    })
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const submitAd = async () => {
    if (!form.sponsor_name.trim() || !form.headline.trim() || !form.link_url.trim()) {
      toast({ title: "Missing fields", description: "Sponsor, headline, and link URL are required." })
      return
    }
    setCreating(true)
    try {
      const payload = {
        sponsor_name: form.sponsor_name.trim(),
        headline: form.headline.trim(),
        description: form.description.trim() || null,
        media_url: form.media_url.trim() || null,
        media_type: form.media_url.trim() ? form.media_type : null,
        link_url: form.link_url.trim(),
      }
      const res = await fetch(editingId ? `/api/admin/ads/${editingId}` : "/api/admin/ads", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(editingId ? payload : { ...payload, is_active: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save ad")
      const saved: AdRow = data.ad
      setAds((prev) => {
        const exists = prev.some((a) => a.id === saved.id)
        return exists ? prev.map((a) => (a.id === saved.id ? { ...a, ...saved } : a)) : [saved, ...prev]
      })
      toast({
        title: editingId ? "Ad updated" : "Ad created",
        description: `${saved.sponsor_name} ${saved.is_active ? "is in the rotation" : "is saved but paused"}.`,
      })
      resetForm()
    } catch (error: any) {
      toast({ title: editingId ? "Update failed" : "Create failed", description: error.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const toggleAd = async (ad: AdRow) => {
    setBusyId(ad.id)
    setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, is_active: !a.is_active } : a)))
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ is_active: !ad.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update ad")
      setAds((prev) => prev.map((a) => (a.id === ad.id ? data.ad : a)))
      toast({ title: data.ad.is_active ? "Ad is live" : "Ad paused", description: data.ad.headline })
    } catch (error: any) {
      setAds((prev) => prev.map((a) => (a.id === ad.id ? ad : a)))
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const deleteAd = async (ad: AdRow) => {
    setBusyId(ad.id)
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, { method: "DELETE", headers: { ...getAuthHeader() } })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete ad")
      }
      setAds((prev) => prev.filter((a) => a.id !== ad.id))
      if (editingId === ad.id) resetForm()
      toast({ title: "Ad deleted", description: ad.headline })
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const totals = useMemo(() => {
    return ads.reduce(
      (acc, ad) => ({
        impressions: acc.impressions + (ad.impressions || 0),
        clicks: acc.clicks + (ad.clicks || 0),
      }),
      { impressions: 0, clicks: 0 },
    )
  }, [ads])

  const overallCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const activeCount = ads.filter((a) => a.is_active).length

  // Live preview mirrors the exact unit the feed renders.
  const previewAd = {
    id: editingId || "preview",
    sponsor_name: form.sponsor_name.trim() || "Your sponsor",
    headline: form.headline.trim() || "A headline that earns the tap",
    description: form.description.trim() || "Supporting copy that explains the offer in one breath.",
    media_url: form.media_url.trim() || null,
    media_type: form.media_url.trim() ? form.media_type : null,
    link_url: form.link_url.trim() || "https://loopapp.me",
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Overview strip ─────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "System",
            value: settings.enabled ? "Live" : "Paused",
            icon: Power,
            tone: settings.enabled ? "text-emerald-500" : "text-muted-foreground",
          },
          { label: "Active creatives", value: `${activeCount}/${ads.length}`, icon: Megaphone, tone: "text-primary" },
          {
            label: "Impressions",
            value: totals.impressions.toLocaleString(),
            icon: Eye,
            tone: "text-muted-foreground",
          },
          {
            label: "Overall CTR",
            value: `${overallCtr.toFixed(2)}%`,
            icon: MousePointerClick,
            tone: "text-muted-foreground",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn("rounded-xl border border-border bg-muted/50 p-2", stat.tone)}>
                <stat.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="truncate text-lg font-semibold tracking-tight">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loadError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">Couldn&apos;t load the ad system</p>
            <p className="text-muted-foreground">{loadError}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Delivery controls ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-primary" />
            Delivery
          </CardTitle>
          <CardDescription>
            Pro members and Sponsors never see ads — that is enforced server-side. Everyone else (free accounts,
            Organizations and signed-out visitors) sees them per the rules below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Power className={cn("h-4 w-4", settings.enabled ? "text-emerald-500" : "text-muted-foreground")} />
                Master switch
              </p>
              <p className="text-xs text-muted-foreground">Turns the whole ad system on or off, everywhere.</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(value) => void saveSettings({ ...settings, enabled: value })}
              disabled={saving}
              aria-label="Toggle the ad system"
            />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <Label>Pacing — organic posts between sponsored slots</Label>
                <p className="text-xs text-muted-foreground">
                  Each session rolls a gap inside this range. The first slot always lands near the top of the feed so
                  the placement is actually seen.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FREQUENCY_PRESETS.map((preset) => {
                  const active =
                    settings.frequency_min === preset.min && settings.frequency_max === preset.max
                  return (
                    <Button
                      key={preset.label}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="rounded-full text-xs"
                      title={preset.hint}
                      disabled={saving}
                      onClick={() =>
                        void saveSettings(
                          { ...settings, frequency_min: preset.min, frequency_max: preset.max },
                          { silent: true },
                        )
                      }
                    >
                      {preset.label}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="freq-min">Minimum gap</Label>
                <Input
                  id="freq-min"
                  type="number"
                  min={1}
                  max={200}
                  value={settings.frequency_min}
                  onChange={(e) => setSettings((s) => ({ ...s, frequency_min: Number(e.target.value || 1) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="freq-max">Maximum gap</Label>
                <Input
                  id="freq-max"
                  type="number"
                  min={1}
                  max={200}
                  value={settings.frequency_max}
                  onChange={(e) => setSettings((s) => ({ ...s, frequency_max: Number(e.target.value || 1) }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Placements</Label>
            <p className="text-xs text-muted-foreground">
              These are the surfaces the app actually renders. Switching one off stops ads there immediately.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AD_SURFACES.map((surface) => (
                <div
                  key={surface.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{surface.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{surface.hint}</p>
                  </div>
                  <Switch
                    checked={Boolean(settings.surfaces[surface.key])}
                    onCheckedChange={(value) =>
                      setSettings((s) => ({ ...s, surfaces: { ...s.surfaces, [surface.key]: value } }))
                    }
                    aria-label={`Toggle ads on ${surface.label}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={() => void saveSettings(settings)} disabled={saving} className="rounded-full">
            {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            Save delivery settings
          </Button>
        </CardContent>
      </Card>

      {/* ── Composer + live preview ────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Edit creative" : "New creative"}
            </CardTitle>
            <CardDescription>Every field here is what a member sees in the feed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ad-sponsor">Sponsor name</Label>
                <Input
                  id="ad-sponsor"
                  value={form.sponsor_name}
                  onChange={(e) => setForm({ ...form, sponsor_name: e.target.value })}
                  placeholder="e.g. Neon Gaming"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-link">Link URL</Label>
                <Input
                  id="ad-link"
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://sponsor.example/offer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ad-headline">Headline</Label>
              <Input
                id="ad-headline"
                value={form.headline}
                onChange={(e) => setForm({ ...form, headline: e.target.value })}
                placeholder="Level up with the Season 9 pass"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ad-description">Supporting copy</Label>
              <Textarea
                id="ad-description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="One sentence that explains the offer."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Media</Label>
              <input
                ref={adFileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadAdMedia(file)
                }}
              />
              {form.media_url ? (
                <div className="relative overflow-hidden rounded-xl border border-border">
                  {form.media_type === "video" || /\.(mp4|webm|m3u8)(\?|$)/i.test(form.media_url) ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={form.media_url} controls playsInline className="max-h-44 w-full bg-black object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.media_url} alt="Ad media" className="max-h-44 w-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, media_url: "", media_type: "image" }))}
                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-destructive"
                    aria-label="Remove media"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 rounded-xl border-dashed"
                    disabled={uploadingMedia}
                    onClick={() => adFileRef.current?.click()}
                  >
                    {uploadingMedia ? (
                      <Spinner className="mr-2 h-4 w-4" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {uploadingMedia ? "Uploading…" : "Upload image or video"}
                  </Button>
                  <Input
                    className="h-11 sm:max-w-[220px]"
                    value={form.media_url}
                    onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                    placeholder="…or paste a URL"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button onClick={() => void submitAd()} disabled={creating} className="rounded-full">
                {creating ? (
                  <Spinner className="mr-2 h-4 w-4" />
                ) : editingId ? (
                  <Save className="mr-2 h-4 w-4" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                {editingId ? "Save changes" : "Add to rotation"}
              </Button>
              {editingId && (
                <Button variant="ghost" className="rounded-full" onClick={resetForm}>
                  Cancel edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Live preview</h3>
            <Badge variant="outline" className="rounded-full text-[10px]">
              Feed unit
            </Badge>
          </div>
          <AdCard ad={previewAd} preview />
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Previews never count as an impression, so your own stats stay honest.
          </p>
        </div>
      </div>

      {/* ── Rotation ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Rotation
            </CardTitle>
            <CardDescription>
              {activeCount} active of {ads.length} creative{ads.length === 1 ? "" : "s"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {ads.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No creatives yet. Add one above and it joins the rotation the moment the master switch is on.
            </p>
          ) : (
            ads.map((ad) => {
              const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0
              const busy = busyId === ad.id
              return (
                <div
                  key={ad.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border p-3 transition-colors sm:flex-row sm:items-center",
                    ad.is_active ? "border-border" : "border-dashed border-border bg-muted/30",
                  )}
                >
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/50">
                    {ad.media_url ? (
                      ad.media_type === "video" ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={ad.media_url} muted playsInline className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ad.media_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{ad.headline}</p>
                      <Badge variant={ad.is_active ? "default" : "outline"} className="rounded-full text-[10px]">
                        {ad.is_active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{ad.sponsor_name}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {ad.impressions.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" />
                        {ad.clicks.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <span
                            className="block h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, ctr * 10)}%` }}
                          />
                        </span>
                        {ctr.toFixed(2)}% CTR
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="rounded-full text-xs" asChild>
                      <a href={ad.link_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" /> Open
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs"
                      disabled={busy}
                      onClick={() => startEdit(ad)}
                    >
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs"
                      disabled={busy}
                      onClick={() => void toggleAd(ad)}
                    >
                      <Power className="mr-1 h-3 w-3" /> {ad.is_active ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-full text-xs"
                      disabled={busy}
                      onClick={() => void deleteAd(ad)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
