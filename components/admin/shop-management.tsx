"use client"
import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Edit, Trash2, Coins, TrendingUp, Eye, EyeOff, Copy, Film, X, Search, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"
import { CustomMedia, customMediaFor } from "@/components/shop/custom-media"
import { ShopItemMiniPreview, type ShopPreviewItem } from "@/components/shop/shop-item-preview"
import { itemIllustration } from "@/components/shop/shop-art"
import { MAX_PROFILE_CUSTOM_CSS_BYTES } from "@/lib/profile-custom-css-limits"

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  price_coins?: number
  price_usd?: number
  category: string
  item_type: string
  rarity: string
  is_active: boolean
  premium_only: boolean
  created_at: string
  sales_count: number
  image_url?: string
  animation_url?: string
  item_data?: any
  preview_data?: any
}

const CATEGORIES = [
  { value: "theme", label: "Theme" },
  { value: "badge", label: "Badge" },
  { value: "animation", label: "Animation" },
  { value: "effect", label: "Effect" },
  { value: "card_effect", label: "Card Effect" },
  { value: "font", label: "Font" },
  { value: "avatar", label: "Avatar Frame" },
  { value: "premium", label: "Premium" },
  { value: "coins", label: "Coins" },
]

const ITEM_TYPES = [
  { value: "profile_theme", label: "Profile Theme" },
  { value: "theme", label: "Theme" },
  { value: "achievement_badge", label: "Achievement Badge" },
  { value: "gift_item", label: "Gift Item" },
  { value: "avatar_effect", label: "Avatar Effect" },
  { value: "aura_effect", label: "Aura Effect" },
  { value: "particle_effect", label: "Particle Effect" },
  { value: "post_card_effect", label: "Post Card Effect" },
  { value: "card_border", label: "Card Border" },
  { value: "cursor_effect", label: "Cursor Effect" },
  { value: "font_family", label: "Font Family" },
  { value: "accessory", label: "Accessory" },
  { value: "subscription", label: "Subscription" },
  { value: "currency", label: "Currency" },
  { value: "gift_currency", label: "Gift Currency" },
]

const RARITIES = ["common", "rare", "epic", "legendary"]

/** The animation an item name resolves to, by its readable name. */
function illustrationName(item: { name?: string; description?: string; category?: string }) {
  const art = itemIllustration(item) as { nm?: string } | null
  return art?.nm || null
}

/** Art lives in item_data on this schema, with the row columns as a fallback. */
function artFromItem(item: ShopItem, key: "image_url" | "animation_url"): string {
  const direct = item[key]
  if (typeof direct === "string" && direct) return direct
  const value = (item.item_data || {})[key]
  return typeof value === "string" ? value : ""
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-slate-500",
  rare: "bg-sky-500",
  epic: "bg-violet-500",
  legendary: "bg-amber-500",
}

function emptyItem(): Omit<ShopItem, "id" | "created_at" | "sales_count"> {
  return {
    name: "",
    description: "",
    price: 0,
    price_coins: 0,
    category: "badge",
    item_type: "achievement_badge",
    rarity: "common",
    is_active: true,
    premium_only: false,
    image_url: "",
    animation_url: "",
  }
}

/** Cloudinary serves uploaded audio from its video resource. */
const AUDIO_URL = /\.(?:mp3|wav|ogg|m4a|aac|flac|opus)(?:[?#]|$)/i

/**
 * One piece of item art: upload it, paste a URL, or clear it.
 *
 * Uploads go straight to Cloudinary through `/api/upload/sign`, so a 40MB
 * looping video never has to pass through a route handler — and any file the
 * admin picks (photo, GIF, MP4/WebM, audio, or a Lottie `.json` export) renders
 * in the preview below exactly as the storefront will draw it.
 */
export function MediaField({
  label,
  hint,
  value,
  onChange,
  accept = "image/*,video/*,.json",
}: {
  label: string
  hint: string
  value: string
  onChange: (url: string) => void
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const type = file.type.startsWith("video/") || file.type.startsWith("audio/")
        ? "video"
        : file.type === "application/json" || file.name.endsWith(".json")
          ? "file"
          : "image"

      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ type, folder: "shop-items" }),
      })
      const sign = await signRes.json()
      if (!signRes.ok) throw new Error(sign.error || "Uploads are not configured")

      const body = new FormData()
      body.append("file", file)
      body.append("api_key", sign.apiKey)
      body.append("timestamp", String(sign.timestamp))
      body.append("signature", sign.signature)
      body.append("folder", sign.folder)

      const resource = sign.resourceType || "auto"
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/${resource}/upload`, {
        method: "POST",
        body,
      })
      const uploaded = await uploadRes.json()
      if (!uploadRes.ok || !uploaded.secure_url) throw new Error(uploaded.error?.message || "Upload failed")

      onChange(uploaded.secure_url)
      toast({ description: `${label} uploaded` })
    } catch (cause) {
      toast({
        title: "Upload failed",
        description: cause instanceof Error ? cause.message : "Try again in a moment.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="truncate text-[10px] text-muted-foreground">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file) void upload(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-full text-[11px]"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Spinner className="mr-1 h-3 w-3" /> : <Upload className="mr-1 h-3 w-3" />}
            Upload
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2 text-[11px] text-muted-foreground"
              onClick={() => onChange("")}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative h-28 overflow-hidden rounded-lg border border-dashed border-border bg-background/60">
        {value ? (
          AUDIO_URL.test(value) ? (
            <div className="flex h-full items-center px-3">
              <audio src={value} controls preload="metadata" className="w-full" />
            </div>
          ) : (
            <CustomMedia url={value} alt={label} />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-[11px] text-muted-foreground">
            <Film className="h-4 w-4" />
            Drop in a PNG, GIF, MP4, WebM, audio file or Lottie JSON
          </div>
        )}
      </div>

      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="…or paste a URL"
        className="h-8 text-xs"
      />
    </div>
  )
}

export function ShopManagement() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null)
  const [form, setForm] = useState(emptyItem())
  const [saving, setSaving] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [rarityFilter, setRarityFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "no-art">("all")
  const { user } = useAuth()
  const { toast } = useToast()

  const authHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${user?.token}`,
  }), [user?.token])

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/shop-items", { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      toast({ title: "Error", description: "Failed to load shop items", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [authHeaders, toast])

  useEffect(() => { void fetchItems() }, [fetchItems])

  const createItem = async () => {
    if (!form.name) { toast({ title: "Name required", variant: "destructive" }); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/shop-items", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...form,
          price_coins: form.price,
          item_data: {
            ...(form.item_data || {}),
            ...(form.image_url ? { image_url: form.image_url } : {}),
            ...(form.animation_url ? { animation_url: form.animation_url } : {}),
          },
          preview_data: form.preview_data || {},
        }),
      })
      if (!res.ok) throw new Error("Failed")
      await fetchItems()
      setShowCreateDialog(false)
      setForm(emptyItem())
      toast({ description: "Item created" })
    } catch {
      toast({ title: "Error", description: "Failed to create item", variant: "destructive" })
    }
    setSaving(false)
  }

  const updateItem = async () => {
    if (!editingItem) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/shop-items", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          id: editingItem.id,
          ...form,
          price_coins: form.price,
          item_data: {
            ...(form.item_data || {}),
            ...(form.image_url ? { image_url: form.image_url } : {}),
            ...(form.animation_url ? { animation_url: form.animation_url } : {}),
          },
        }),
      })
      if (!res.ok) throw new Error("Failed")
      await fetchItems()
      setEditingItem(null)
      setForm(emptyItem())
      toast({ description: "Item updated" })
    } catch {
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" })
    }
    setSaving(false)
  }

  const deleteItem = async (item: ShopItem) => {
    if (
      !(await confirmDialog({
        title: `Delete "${item.name}"?`,
        description:
          "Buyers keep what they paid for — their inventory row stores its own copy of the item — but it leaves the shop permanently.",
        confirmLabel: "Delete item",
        destructive: true,
      }))
    )
      return
    try {
      const res = await fetch(`/api/admin/shop-items?id=${item.id}`, { method: "DELETE", headers: authHeaders() })
      if (!res.ok) throw new Error("Failed")
      await fetchItems()
      toast({ description: "Item deleted" })
    } catch {
      toast({ title: "Error", description: "Failed to delete item", variant: "destructive" })
    }
  }

  const toggleActive = async (item: ShopItem) => {
    try {
      const res = await fetch("/api/admin/shop-items", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      })
      if (!res.ok) throw new Error("Failed")
      await fetchItems()
    } catch {
      toast({ title: "Error", variant: "destructive" })
    }
  }

  const openEdit = (item: ShopItem) => {
    setEditingItem(item)
    setForm({
      name: item.name,
      description: item.description,
      price: item.price || item.price_coins || 0,
      price_coins: item.price_coins,
      price_usd: item.price_usd,
      category: item.category,
      item_type: item.item_type,
      rarity: item.rarity,
      is_active: item.is_active,
      premium_only: item.premium_only,
      image_url: artFromItem(item, "image_url"),
      animation_url: artFromItem(item, "animation_url"),
      item_data: item.item_data,
      preview_data: item.preview_data,
    })
  }

  const duplicateItem = (item: ShopItem) => {
    setEditingItem(null)
    setForm({
      name: `${item.name} copy`,
      description: item.description,
      price: item.price || item.price_coins || 0,
      price_coins: item.price_coins,
      price_usd: item.price_usd,
      category: item.category,
      item_type: item.item_type,
      rarity: item.rarity,
      // A duplicate starts hidden so it cannot go live by accident.
      is_active: false,
      premium_only: item.premium_only,
      image_url: artFromItem(item, "image_url"),
      animation_url: artFromItem(item, "animation_url"),
      item_data: item.item_data,
      preview_data: item.preview_data,
    })
    setShowCreateDialog(true)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false
      if (rarityFilter !== "all" && (item.rarity || "").toLowerCase() !== rarityFilter) return false
      if (statusFilter === "active" && !item.is_active) return false
      if (statusFilter === "hidden" && item.is_active) return false
      if (statusFilter === "no-art" && customMediaFor(item as unknown as Record<string, unknown>)) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.rarity.toLowerCase().includes(q)
      )
    })
  }, [items, search, categoryFilter, rarityFilter, statusFilter])

  const stats = {
    total: items.length,
    active: items.filter((i) => i.is_active).length,
    totalSales: items.reduce((s, i) => s + (i.sales_count || 0), 0),
    totalRevenue: items.reduce((s, i) => s + (i.price || 0) * (i.sales_count || 0), 0),
    /* How much of the catalogue has real art, which is the thing that decides
       whether the storefront looks like a shop or a list of labels. */
    withArt: items.filter((i) => customMediaFor(i as unknown as Record<string, unknown>)).length,
  }

  /* ── Item form (shared between create and edit) ── */
  function ItemForm({ mode }: { mode: "create" | "edit" }) {
    const themeData = (form.item_data || {}) as Record<string, unknown>
    const setThemeData = (patch: Record<string, unknown>) =>
      setForm((current) => ({ ...current, item_data: { ...(current.item_data || {}), ...patch } }))
    const showProfileTheme = form.category === "theme" || form.item_type === "profile_theme"
    const profileCss = typeof themeData.profile_css === "string" ? themeData.profile_css : ""
    const profileCssBytes = new TextEncoder().encode(profileCss).length

    return (
      <div className="max-h-[72vh] space-y-4 overflow-y-auto px-0.5 pr-1">
        {/* What the storefront will actually draw for this item, right now. */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
            <ShopItemMiniPreview item={form as unknown as ShopPreviewItem} />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Eye className="h-3.5 w-3.5 text-violet-500" />
              Storefront preview
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {customMediaFor(form as unknown as Record<string, unknown>)
                ? "Using your uploaded art, exactly as buyers see it."
                : illustrationName(form)
                  ? `No art attached, so the name-matched “${illustrationName(form)}” animation is used.`
                  : "No art attached — upload something, or rename it after what it is."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MediaField
            label="Card art"
            hint="image, GIF, video or Lottie"
            value={form.image_url || ""}
            onChange={(url) => setForm({ ...form, image_url: url })}
          />
          <MediaField
            label="Animation"
            hint="overrides the card art where motion helps"
            value={form.animation_url || ""}
            onChange={(url) => setForm({ ...form, animation_url: url })}
          />
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 24K Rose Garden" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What the buyer sees" rows={2} className="mt-1" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Price (coins)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number.parseInt(e.target.value) || 0 })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rarity</Label>
              <Select value={form.rarity} onValueChange={(v) => setForm({ ...form, rarity: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{RARITIES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Item Type</Label>
            <Select value={form.item_type} onValueChange={(v) => setForm({ ...form, item_type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{ITEM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={form.premium_only} onCheckedChange={(v) => setForm({ ...form, premium_only: v })} />
              <Label className="text-xs">Pro only</Label>
            </div>
          </div>

          {/* Profile themes are the only items that restyle a buyer's profile:
              CSS, artwork and soundtrack all travel with the item and are
              applied by the inventory equip endpoint. */}
          {showProfileTheme ? (
            <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Profile theme</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                  Equipping this item restyles the buyer's profile. The CSS is scoped to the profile, sanitised
                  server-side, and never sent to the storefront.
                </p>
              </div>

              <MediaField
                label="Profile background"
                hint="the picture painted behind their profile"
                accept="image/*"
                value={typeof themeData.profile_background_url === "string" ? themeData.profile_background_url : ""}
                onChange={(url) => setThemeData({ profile_background_url: url })}
              />

              <MediaField
                label="Soundtrack"
                hint="loops softly, starting on the visitor's first tap"
                accept="audio/*"
                value={typeof themeData.profile_audio_url === "string" ? themeData.profile_audio_url : ""}
                onChange={(url) => setThemeData({ profile_audio_url: url })}
              />

              <div>
                <Label className="text-xs">Soundtrack title</Label>
                <Input
                  value={typeof themeData.profile_audio_title === "string" ? themeData.profile_audio_title : ""}
                  onChange={(event) => setThemeData({ profile_audio_title: event.target.value })}
                  placeholder="e.g. Gilded Dusk — Nocturne"
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Profile CSS</Label>
                  <span
                    className={cn(
                      "text-[10px] tabular-nums",
                      profileCssBytes > MAX_PROFILE_CUSTOM_CSS_BYTES ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {profileCssBytes.toLocaleString()} / {MAX_PROFILE_CUSTOM_CSS_BYTES.toLocaleString()} bytes
                  </span>
                </div>
                <Textarea
                  value={profileCss}
                  onChange={(event) => setThemeData({ profile_css: event.target.value })}
                  placeholder=".loop-profile-custom-css { --gold: #e8c98b; }"
                  rows={8}
                  spellCheck={false}
                  className="mt-1 font-mono text-[11px] leading-relaxed"
                />
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Selectors are scoped to <code>.loop-profile-custom-css</code> automatically. url(), @import and
                  script values are rejected.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <Button onClick={mode === "create" ? createItem : updateItem} disabled={saving} className="w-full">
          {saving ? "Saving..." : mode === "create" ? "Create Item" : "Save Changes"}
        </Button>
      </div>
    )
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading shop items…</div>
  }

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total items", value: stats.total, icon: <Plus className="h-3.5 w-3.5" /> },
          { label: "Active", value: stats.active, icon: <Eye className="h-3.5 w-3.5" /> },
          { label: "Sales", value: stats.totalSales, icon: <TrendingUp className="h-3.5 w-3.5" /> },
          { label: "Revenue", value: `${stats.totalRevenue.toLocaleString()}`, icon: <Coins className="h-3.5 w-3.5" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card/60 p-3 backdrop-blur">
            <div className="flex items-center gap-1.5 text-muted-foreground">{s.icon}<span className="text-[11px] font-medium">{s.label}</span></div>
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="pl-8 text-sm" />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-9 rounded-full text-xs sm:w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={rarityFilter} onValueChange={setRarityFilter}>
          <SelectTrigger className="h-9 rounded-full text-xs sm:w-[130px]"><SelectValue placeholder="Rarity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rarities</SelectItem>
            {RARITIES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-9 rounded-full text-xs sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every item</SelectItem>
            <SelectItem value="active">Live only</SelectItem>
            <SelectItem value="hidden">Hidden only</SelectItem>
            <SelectItem value="no-art">Missing art</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span> of {items.length}
          <span aria-hidden> · </span>
          <span className="tabular-nums">{stats.withArt}</span> with custom art
        </p>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full"><Plus className="mr-1.5 h-3.5 w-3.5" /> New Item</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create Shop Item</DialogTitle></DialogHeader>
            <ItemForm mode="create" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={Boolean(editingItem)} onOpenChange={(o) => { if (!o) { setEditingItem(null); setForm(emptyItem()) } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit: {editingItem?.name}</DialogTitle></DialogHeader>
          <ItemForm mode="edit" />
        </DialogContent>
      </Dialog>

      {/* Items grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/30 py-16 text-center">
          <p className="text-sm text-muted-foreground">{search ? "No items match your search" : "No shop items yet"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all",
                item.is_active ? "border-border" : "border-border/50 opacity-60",
              )}
            >
              {/* Exactly what the storefront card renders — custom art first,
                  then the name-matched animation, then the generic preview. */}
              <div className="relative h-32 border-b border-border bg-muted/20">
                <ShopItemMiniPreview item={item as unknown as ShopPreviewItem} />
                {!customMediaFor(item as unknown as Record<string, unknown>) ? (
                  <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground backdrop-blur">
                    No art
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{item.name}</h3>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.category} · {item.item_type}</p>
                  </div>
                  <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", RARITY_COLORS[item.rarity] || RARITY_COLORS.common)} />
                </div>

                {item.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                )}

                <div className="mt-auto flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Coins className="h-3 w-3 text-amber-400" />
                    <span className="font-semibold text-foreground">{(item.price || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>{item.sales_count || 0} sold</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => openEdit(item)} className="flex-1 rounded-full text-xs">
                    <Edit className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title="Duplicate"
                    onClick={() => duplicateItem(item)}
                    className="rounded-full px-2 text-xs"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    title={item.is_active ? "Hide from the shop" : "Show in the shop"}
                    onClick={() => toggleActive(item)}
                    className={cn("rounded-full px-2 text-xs", item.is_active ? "text-amber-500" : "text-emerald-500")}
                  >
                    {item.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => deleteItem(item)} className="rounded-full px-2 text-xs text-destructive hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
