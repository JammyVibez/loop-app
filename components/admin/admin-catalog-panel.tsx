"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, RefreshCw, Sparkles } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"

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
    premium_only: false,
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
          premium_only: form.premium_only,
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
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
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
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
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
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
