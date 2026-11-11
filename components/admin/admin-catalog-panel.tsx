"use client"

import { useCallback, useEffect, useState } from "react"
import { ImageIcon, Palette, Plus, RefreshCw, Zap } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/skeletons"
import { MediaField } from "@/components/admin/shop-management"
import { MAX_PROFILE_CUSTOM_CSS_BYTES } from "@/lib/profile-custom-css-limits"

interface CatalogItem {
  id: string
  name: string
  description?: string
  category: string
  item_type?: string
  rarity?: string
  price_coins?: number
  is_active?: boolean
  item_data?: any
  preview_data?: any
  created_at?: string
}

const PRESETS = [
  { id: "aurora", label: "Aurora" },
  { id: "ember", label: "Ember" },
  { id: "mint", label: "Mint" },
  { id: "midnight", label: "Midnight" },
]

const FONT_PRESETS = [
  { id: "inter", label: "Inter (default)" },
  { id: "poppins", label: "Poppins" },
  { id: "playfair", label: "Playfair Display" },
  { id: "space_grotesk", label: "Space Grotesk" },
  { id: "jetbrains_mono", label: "JetBrains Mono" },
  { id: "pacifico", label: "Pacifico (script)" },
]

const FRAME_VARIANTS = [
  { id: "none", label: "Static (no animation)" },
  { id: "ring_rotate", label: "Rotating gradient ring" },
  { id: "orbit_particles", label: "Orbiting sparkles" },
  { id: "pulse_glow", label: "Pulsing glow" },
  { id: "tilt_3d", label: "3D tilt on hover" },
]

const CARD_VARIANTS = [
  { id: "none", label: "Static border" },
  { id: "gradient_border", label: "Animated gradient border" },
  { id: "shimmer", label: "Periodic shimmer pass" },
  { id: "pulse_edge", label: "Pulsing glow edge" },
]

const PFP_INTERACTIONS = [
  { id: "none", label: "None" },
  { id: "burst", label: "Particle burst" },
  { id: "bounce", label: "Bounce pop" },
  { id: "pulse", label: "Glow pulse" },
]

const CATEGORY_LABELS: Record<string, string> = {
  theme: "Theme",
  effect: "Effect",
  animation: "Animation",
  font: "Font",
  card_effect: "Card Effect",
}

export function AdminCatalogPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "theme",
    rarity: "common",
    price_coins: "100",
    preset: "aurora",
    font_preset: "inter",
    frame_variant: "none",
    card_variant: "none",
    pfp_interaction: "none",
    premium_only: false,
    // Profile themes only: the CSS, artwork and soundtrack the buyer receives.
    profile_css: "",
    profile_background_url: "",
    profile_audio_url: "",
    profile_audio_title: "",
    profile_audio_enabled: true,
    profile_audio_autoplay: true,
  })

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/catalog", { headers: getAuthHeader() })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load catalog")
      setItems(data.items || [])
    } catch (error: any) {
      toast({ title: "Catalog load failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, toast])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const createItem = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category,
          rarity: form.rarity,
          price_coins: Number(form.price_coins) || 0,
          preset: form.preset,
          font_preset: form.font_preset,
          frame_variant: form.frame_variant,
          card_variant: form.card_variant,
          pfp_interaction: form.pfp_interaction,
          premium_only: form.premium_only,
          ...(form.category === "theme"
            ? {
                profile_css: form.profile_css,
                profile_background_url: form.profile_background_url,
                profile_audio_url: form.profile_audio_url,
                profile_audio_title: form.profile_audio_title,
                profile_audio_enabled: form.profile_audio_enabled,
                profile_audio_autoplay: form.profile_audio_autoplay,
              }
            : {}),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Create failed")
      toast({ title: "Created", description: `${form.category} “${form.name}” is live in the shop.` })
      setForm((prev) => ({ ...prev, name: "", description: "" }))
      await loadItems()
    } catch (error: any) {
      toast({ title: "Create failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Themes & Effects</h2>
          <p className="text-sm text-muted-foreground">
            Create shop themes and profile effects. They appear in Shop and Inventory immediately.
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={loadItems}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> New catalog item
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="theme">Theme</TabsTrigger>
              <TabsTrigger value="effect">Effect</TabsTrigger>
              <TabsTrigger value="animation">Animation</TabsTrigger>
              <TabsTrigger value="font">Font</TabsTrigger>
              <TabsTrigger value="card_effect">Card Effect</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Neon Mist Theme"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-price">Price (coins)</Label>
              <Input
                id="cat-price"
                type="number"
                min={0}
                value={form.price_coins}
                onChange={(e) => setForm((p) => ({ ...p, price_coins: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-rarity">Rarity</Label>
              <select
                id="cat-rarity"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.rarity}
                onChange={(e) => setForm((p) => ({ ...p, rarity: e.target.value }))}
              >
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </div>
            {form.category === "font" ? (
              <div className="space-y-1.5">
                <Label htmlFor="cat-font">Font family</Label>
                <select
                  id="cat-font"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.font_preset}
                  onChange={(e) => setForm((p) => ({ ...p, font_preset: e.target.value }))}
                >
                  {FONT_PRESETS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="cat-preset">Color preset</Label>
                <select
                  id="cat-preset"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.preset}
                  onChange={(e) => setForm((p) => ({ ...p, preset: e.target.value }))}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {["animation", "effect"].includes(form.category) && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-frame">Avatar frame animation</Label>
                  <select
                    id="cat-frame"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.frame_variant}
                    onChange={(e) => setForm((p) => ({ ...p, frame_variant: e.target.value }))}
                  >
                    {FRAME_VARIANTS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cat-pfp">PFP tap/hover effect</Label>
                  <select
                    id="cat-pfp"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.pfp_interaction}
                    onChange={(e) => setForm((p) => ({ ...p, pfp_interaction: e.target.value }))}
                  >
                    {PFP_INTERACTIONS.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {form.category === "card_effect" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cat-card">Post card animation</Label>
                <select
                  id="cat-card"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.card_variant}
                  onChange={(e) => setForm((p) => ({ ...p, card_variant: e.target.value }))}
                >
                  {CARD_VARIANTS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.category === "theme" ? (
              <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 sm:col-span-2">
                <div>
                  <p className="text-xs font-semibold">Profile theme</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                    Attached to the buyer&apos;s profile when they equip this theme: a background picture, GIF or short
                    video, a looping soundtrack, and CSS scoped to their profile. The CSS is sanitised on save and
                    never sent to the storefront.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MediaField
                    label="Profile background"
                    hint="image, GIF or short video behind the profile"
                    accept="image/*,video/*"
                    value={form.profile_background_url}
                    onChange={(url) => setForm((p) => ({ ...p, profile_background_url: url }))}
                  />
                  <MediaField
                    label="Soundtrack"
                    hint="loops softly from the visitor's first tap"
                    accept="audio/*"
                    value={form.profile_audio_url}
                    onChange={(url) => setForm((p) => ({ ...p, profile_audio_url: url }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cat-audio-title">Soundtrack title</Label>
                  <Input
                    id="cat-audio-title"
                    value={form.profile_audio_title}
                    onChange={(e) => setForm((p) => ({ ...p, profile_audio_title: e.target.value }))}
                    placeholder="e.g. Gilded Dusk — Nocturne"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2">
                    <span>
                      <span className="block text-[11px] font-medium">Sound on by default</span>
                      <span className="block text-[10px] text-muted-foreground">Off ships it silent.</span>
                    </span>
                    <Switch
                      checked={form.profile_audio_enabled}
                      onCheckedChange={(checked) => setForm((p) => ({ ...p, profile_audio_enabled: checked }))}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2">
                    <span>
                      <span className="block text-[11px] font-medium">Starts automatically</span>
                      <span className="block text-[10px] text-muted-foreground">Off waits for a tap.</span>
                    </span>
                    <Switch
                      checked={form.profile_audio_autoplay}
                      onCheckedChange={(checked) => setForm((p) => ({ ...p, profile_audio_autoplay: checked }))}
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="cat-profile-css">Profile CSS</Label>
                    <span
                      className={
                        new TextEncoder().encode(form.profile_css).length > MAX_PROFILE_CUSTOM_CSS_BYTES
                          ? "text-[10px] tabular-nums text-destructive"
                          : "text-[10px] tabular-nums text-muted-foreground"
                      }
                    >
                      {new TextEncoder().encode(form.profile_css).length.toLocaleString()} /{" "}
                      {MAX_PROFILE_CUSTOM_CSS_BYTES.toLocaleString()} bytes
                    </span>
                  </div>
                  <Textarea
                    id="cat-profile-css"
                    value={form.profile_css}
                    onChange={(e) => setForm((p) => ({ ...p, profile_css: e.target.value }))}
                    placeholder=".loop-profile-custom-css { --accent: #e8c98b; }"
                    rows={8}
                    spellCheck={false}
                    className="font-mono text-[11px] leading-relaxed"
                  />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Selectors are scoped to <code>.loop-profile-custom-css</code> automatically. url(), @import and
                    script values are rejected, and the profile limit applies.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-md border border-input px-3 sm:col-span-2">
              <div>
                <Label htmlFor="cat-premium" className="cursor-pointer">
                  Pro-only cosmetic
                </Label>
                <p className="text-xs text-muted-foreground">Only Loop Pro members can equip this item.</p>
              </div>
              <Switch
                id="cat-premium"
                checked={form.premium_only}
                onCheckedChange={(checked) => setForm((p) => ({ ...p, premium_only: checked }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Short blurb for the shop card"
              className="min-h-[72px]"
            />
          </div>

          <Button onClick={createItem} disabled={saving} className="rounded-full">
            {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Zap className="mr-2 h-4 w-4" />}
            Create {form.category}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live catalog ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Spinner className="mr-2 h-5 w-5" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No themes or effects yet.</p>
          ) : (
            items.map((item) => {
              const primary = item.item_data?.colors?.primary || item.preview_data?.colors?.primary || "#8b5cf6"
              const secondary = item.item_data?.colors?.secondary || item.preview_data?.colors?.secondary || "#3b82f6"
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="h-10 w-10 shrink-0 rounded-xl border"
                      style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-semibold">{item.name}</p>
                        <Badge variant="secondary">{item.category}</Badge>
                        {item.rarity && <Badge variant="outline">{item.rarity}</Badge>}
                        {item.is_active === false && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {Number(item.price_coins || 0).toLocaleString()} coins · {item.item_type || "item"}
                      </p>
                    </div>
                  </div>

                  {(item.category === "theme" || item.item_type?.includes("profile_theme")) && (
                    <ThemeEditor item={item} getAuthHeader={getAuthHeader} onSaved={loadItems} />
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Editor for a catalog theme that already exists.
 *
 * The create form can build a theme, but changing one afterwards used to mean
 * hunting the item down in Shop management — and even there the profile
 * background could only be swapped for another picture. This edits the parts
 * an owner actually receives: the name and price, the background (image, GIF or
 * short video), the soundtrack and its defaults, and the scoped profile CSS.
 * The server sanitises the CSS and validates both media URLs before saving, so
 * a mistake here can never escape the profile.
 */
function ThemeEditor({
  item,
  getAuthHeader,
  onSaved,
}: {
  item: {
    id: string
    name: string
    price_coins?: number
    rarity?: string
    is_active?: boolean
    item_data?: any
  }
  getAuthHeader: () => Record<string, string>
  onSaved: () => Promise<void> | void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const initial = (item.item_data || {}) as Record<string, unknown>
  const [name, setName] = useState(item.name)
  const [price, setPrice] = useState(String(item.price_coins ?? 0))
  const [rarity, setRarity] = useState(item.rarity || "common")
  const [active, setActive] = useState(item.is_active !== false)
  const [backgroundUrl, setBackgroundUrl] = useState(
    typeof initial.profile_background_url === "string" ? initial.profile_background_url : "",
  )
  const [audioUrl, setAudioUrl] = useState(typeof initial.profile_audio_url === "string" ? initial.profile_audio_url : "")
  const [title, setTitle] = useState(typeof initial.profile_audio_title === "string" ? initial.profile_audio_title : "")
  const [enabled, setEnabled] = useState(initial.profile_audio_enabled !== false)
  const [autoplay, setAutoplay] = useState(initial.profile_audio_autoplay !== false)
  const [css, setCss] = useState(typeof initial.profile_css === "string" ? initial.profile_css : "")
  const cssBytes = new TextEncoder().encode(css).length

  // Re-read the row each time the dialog opens, so a save (or a change made in
  // Shop management) is reflected instead of the state captured at mount.
  const changeOpen = (next: boolean) => {
    if (next) {
      const fresh = (item.item_data || {}) as Record<string, unknown>
      setName(item.name)
      setPrice(String(item.price_coins ?? 0))
      setRarity(item.rarity || "common")
      setActive(item.is_active !== false)
      setBackgroundUrl(typeof fresh.profile_background_url === "string" ? fresh.profile_background_url : "")
      setAudioUrl(typeof fresh.profile_audio_url === "string" ? fresh.profile_audio_url : "")
      setTitle(typeof fresh.profile_audio_title === "string" ? fresh.profile_audio_title : "")
      setEnabled(fresh.profile_audio_enabled !== false)
      setAutoplay(fresh.profile_audio_autoplay !== false)
      setCss(typeof fresh.profile_css === "string" ? fresh.profile_css : "")
    }
    setOpen(next)
  }

  const save = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" })
      return
    }
    if (cssBytes > MAX_PROFILE_CUSTOM_CSS_BYTES) {
      toast({ title: "Profile CSS is over the limit", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/admin/shop-items", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          id: item.id,
          name: name.trim(),
          price_coins: Number(price) || 0,
          rarity,
          is_active: active,
          item_data: {
            ...(item.item_data || {}),
            profile_background_url: backgroundUrl.trim(),
            profile_audio_url: audioUrl.trim(),
            profile_audio_title: title.trim(),
            profile_audio_enabled: enabled,
            profile_audio_autoplay: autoplay,
            profile_css: css,
          },
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Failed to save the theme")
      toast({ description: `${name.trim()} saved. Re-equipping it applies the new background.` })
      setOpen(false)
      await onSaved()
    } catch (error: any) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full">
          <Palette className="mr-1.5 h-3.5 w-3.5" />
          Edit theme
          {!active && <span className="ml-1.5 text-[10px] text-muted-foreground">hidden</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit theme · {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Everything a buyer receives: the background media, soundtrack, its playback defaults and the profile CSS.
            Buyers keep the copy they already own until they re-equip the theme, so changing art never breaks a live
            profile.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`theme-name-${item.id}`}>Name</Label>
              <Input
                id={`theme-name-${item.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`theme-price-${item.id}`}>Price (coins)</Label>
              <Input
                id={`theme-price-${item.id}`}
                type="number"
                min={0}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`theme-rarity-${item.id}`}>Rarity</Label>
              <select
                id={`theme-rarity-${item.id}`}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={rarity}
                onChange={(event) => setRarity(event.target.value)}
              >
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-input px-3">
              <span className="text-xs font-medium">Live in shop</span>
              <Switch checked={active} onCheckedChange={setActive} />
            </label>
          </div>

          <MediaField
            label="Profile background"
            hint="picture, animated GIF or short video"
            accept="image/*,video/*"
            value={backgroundUrl}
            onChange={setBackgroundUrl}
          />

          <MediaField
            label="Soundtrack"
            hint="MP3, WAV, OGG or M4A — loops on the profile"
            accept="audio/*"
            value={audioUrl}
            onChange={setAudioUrl}
          />

          <div className="space-y-1.5">
            <Label htmlFor={`sound-title-${item.id}`}>Soundtrack title</Label>
            <Input
              id={`sound-title-${item.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Malevolent Shrine — Cursed Pulse"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium">Sound on by default</p>
                <p className="text-[10px] text-muted-foreground">Off equips the theme silent.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium">Starts automatically</p>
                <p className="text-[10px] text-muted-foreground">Off waits for the visitor to tap the sound pill.</p>
              </div>
              <Switch checked={autoplay} onCheckedChange={setAutoplay} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`theme-css-${item.id}`}>Profile CSS</Label>
              <span
                className={
                  cssBytes > MAX_PROFILE_CUSTOM_CSS_BYTES
                    ? "text-[10px] tabular-nums text-destructive"
                    : "text-[10px] tabular-nums text-muted-foreground"
                }
              >
                {cssBytes.toLocaleString()} / {MAX_PROFILE_CUSTOM_CSS_BYTES.toLocaleString()} bytes
              </span>
            </div>
            <Textarea
              id={`theme-css-${item.id}`}
              value={css}
              onChange={(event) => setCss(event.target.value)}
              rows={6}
              spellCheck={false}
              className="font-mono text-[11px] leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner className="mr-2 h-4 w-4" /> : <ImageIcon className="mr-2 h-4 w-4" />}
              Save theme
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
