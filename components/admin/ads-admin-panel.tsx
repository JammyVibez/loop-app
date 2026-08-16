"use client"

import { useCallback, useEffect, useState } from "react"
import { Megaphone, Plus, Loader2, Save, Trash2, Power, Eye, MousePointerClick, ExternalLink } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

interface AdSettings {
  enabled: boolean
  frequency_min: number
  frequency_max: number
  surfaces: { home: boolean; circles: boolean; explore: boolean }
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

const EMPTY_FORM = {
  sponsor_name: "",
  headline: "",
  description: "",
  media_url: "",
  media_type: "image",
  link_url: "",
}

export function AdsAdminPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [ads, setAds] = useState<AdRow[]>([])
  const [settings, setSettings] = useState<AdSettings>({
    enabled: false,
    frequency_min: 50,
    frequency_max: 70,
    surfaces: { home: true, circles: false, explore: false },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ads", { headers: { ...getAuthHeader() }, cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load ads")
      setAds(data.ads || [])
      setSettings(data.settings)
    } catch (error: any) {
      toast({ title: "Ads load failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, toast])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSettings = async (next: AdSettings) => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ type: "settings", settings: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setSettings(data.settings)
      toast({
        title: data.settings.enabled ? "Ads are LIVE" : "Ads paused",
        description: `Frequency ${data.settings.frequency_min}–${data.settings.frequency_max} posts · Master switch ${data.settings.enabled ? "on" : "off"}`,
      })
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const createAd = async () => {
    if (!form.sponsor_name.trim() || !form.headline.trim() || !form.link_url.trim()) {
      toast({ title: "Missing fields", description: "Sponsor, headline, and link URL are required." })
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          sponsor_name: form.sponsor_name.trim(),
          headline: form.headline.trim(),
          description: form.description.trim() || null,
          media_url: form.media_url.trim() || null,
          media_type: form.media_url.trim() ? form.media_type : null,
          link_url: form.link_url.trim(),
          is_active: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create ad")
      setAds((prev) => [data.ad, ...prev])
      setForm(EMPTY_FORM)
      toast({ title: "Ad created", description: `${data.ad.sponsor_name} is live in the rotation.` })
    } catch (error: any) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const toggleAd = async (ad: AdRow) => {
    setBusyId(ad.id)
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ is_active: !ad.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update ad")
      setAds((prev) => prev.map((a) => (a.id === ad.id ? data.ad : a)))
      toast({ title: data.ad.is_active ? "Ad active" : "Ad paused", description: data.ad.headline })
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const deleteAd = async (ad: AdRow) => {
    setBusyId(ad.id)
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete ad")
      }
      setAds((prev) => prev.filter((a) => a.id !== ad.id))
      toast({ title: "Ad deleted", description: ad.headline })
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Master control */}
      <Card className={settings.enabled ? "border-emerald-500/40" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-violet-500" />
            Ad system
          </CardTitle>
          <CardDescription>
            Pro users and Sponsors never see ads — enforced server-side. Everyone else (free + Organization accounts)
            sees ads per the frequency and placement rules below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div>
              <p className="flex items-center gap-2 font-medium">
                <Power className={settings.enabled ? "h-4 w-4 text-emerald-500" : "h-4 w-4 text-muted-foreground"} />
                Master switch
              </p>
              <p className="text-xs text-muted-foreground">Instantly disable the entire ad system.</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => void saveSettings({ ...settings, enabled: v })}
              disabled={saving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Frequency — min posts between ads</Label>
              <Input
                type="number"
                min={5}
                max={200}
                value={settings.frequency_min}
                onChange={(e) => setSettings((s) => ({ ...s, frequency_min: Number(e.target.value || 50) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency — max posts between ads</Label>
              <Input
                type="number"
                min={5}
                max={200}
                value={settings.frequency_max}
                onChange={(e) => setSettings((s) => ({ ...s, frequency_max: Number(e.target.value || 70) }))}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Each session picks a random gap inside this range (e.g. 50–70 → one ad every 50–70 organic posts).
          </p>

          <div className="space-y-2">
            <Label>Placement — feed surfaces</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["home", "Home feed"],
                  ["circles", "Circle feeds"],
                  ["explore", "Explore"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-xl border p-3">
                  <span className="text-sm font-medium">{label}</span>
                  <Switch
                    checked={Boolean(settings.surfaces[key])}
                    onCheckedChange={(v) =>
                      setSettings((s) => ({ ...s, surfaces: { ...s.surfaces, [key]: v } }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={() => void saveSettings(settings)} disabled={saving} className="rounded-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save settings
          </Button>
        </CardContent>
      </Card>

      {/* Create ad */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Create ad
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Sponsor name</Label>
            <Input value={form.sponsor_name} onChange={(e) => setForm({ ...form, sponsor_name: e.target.value })} placeholder="e.g. Neon Gaming" />
          </div>
          <div className="space-y-1.5">
            <Label>Headline</Label>
            <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="e.g. Level up with the new Season 9 pass" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Short supporting copy…" />
          </div>
          <div className="space-y-1.5">
            <Label>Media URL (image or video)</Label>
            <Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>Link URL</Label>
            <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://sponsor.example/offer" />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button onClick={() => void createAd()} disabled={creating} className="rounded-full">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create ad
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ads list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live rotation ({ads.filter((a) => a.is_active).length} active)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No ads yet — create your first one above.</p>
          ) : (
            ads.map((ad) => {
              const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00"
              return (
                <div key={ad.id} className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{ad.headline}</p>
                      <Badge variant={ad.is_active ? "default" : "outline"} className="rounded-full">
                        {ad.is_active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {ad.sponsor_name} · <span className="inline-flex items-center gap-0.5"><Eye className="h-3 w-3" /> {ad.impressions.toLocaleString()}</span> ·{" "}
                      <span className="inline-flex items-center gap-0.5"><MousePointerClick className="h-3 w-3" /> {ad.clicks.toLocaleString()} ({ctr}% CTR)</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" className="rounded-full text-xs" asChild>
                      <a href={ad.link_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1 h-3 w-3" /> View
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-xs"
                      disabled={busyId === ad.id}
                      onClick={() => void toggleAd(ad)}
                    >
                      <Power className="mr-1 h-3 w-3" /> {ad.is_active ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-full text-xs"
                      disabled={busyId === ad.id}
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
