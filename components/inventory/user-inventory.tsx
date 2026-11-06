"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useInventoryRealtime } from "@/hooks/use-inventory-realtime"
import { ShopItemMiniPreview, type ShopPreviewItem } from "@/components/shop/shop-item-preview"
import { ProfileFramesPanel } from "@/components/profile/pfp-frames-panel"
import { RarityChip, RARITY_STYLE } from "@/components/shop/shop-item-card"
import { Lottie } from "@/components/ui/lottie"
import { artForItem, LOCK, LOADER, EMPTY_BOX } from "@/components/shop/shop-art"
import { Coins, Palette, ShoppingBag, Sparkles, Shield, Check, Eye, X, Crown, Star, Zap, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

/* ── Inventory item shape from the API ──────────────────────────────────── */
interface InventoryItem {
  id: string
  item_id: string
  item_name: string
  item_type: string
  item_data: any
  preview_data?: any
  is_active: boolean
  purchased_at?: string
  acquired_at?: string
  rarity: string
  category?: string
  shop_item?: any
}

/* ── Shelf keys — match the shop's categorisation ──────────────────────── */
type Shelf = "theme" | "effect" | "identity" | "coins" | "other"

function shelfFor(item: InventoryItem): Shelf {
  const hay = `${item.category || ""} ${item.item_type || ""} ${item.item_name || ""}`.toLowerCase()
  if (hay.includes("theme") && !hay.includes("badge")) return "theme"
  if (hay.includes("coin")) return "coins"
  if (
    hay.includes("badge") || hay.includes("frame") || hay.includes("aura") ||
    hay.includes("font") || hay.includes("avatar") || hay.includes("accessory") ||
    hay.includes("subscription") || hay.includes("premium")
  ) return "identity"
  if (
    hay.includes("effect") || hay.includes("animation") || hay.includes("card_effect") ||
    hay.includes("post_card") || hay.includes("particle") || hay.includes("glow") ||
    hay.includes("cursor") || hay.includes("tree") || hay.includes("branch") ||
    hay.includes("ring") || hay.includes("sparkle")
  ) return "effect"
  return "other"
}

const SHELF_META: Record<Shelf, { label: string; icon: React.ReactNode; hint: string }> = {
  theme: { label: "Themes", icon: <Palette className="h-4 w-4" />, hint: "Accent colour palettes for the app" },
  effect: { label: "Effects", icon: <Sparkles className="h-4 w-4" />, hint: "Visual effects that follow you around" },
  identity: { label: "Identity", icon: <Shield className="h-4 w-4" />, hint: "Badges, frames, fonts, and accessories" },
  coins: { label: "Coins", icon: <Coins className="h-4 w-4" />, hint: "Coin packs and currency" },
  other: { label: "Other", icon: <Star className="h-4 w-4" />, hint: "Miscellaneous items" },
}

/* ── Coerce inventory row into the shape ShopItemMiniPreview expects ──── */
function toShopItem(item: InventoryItem): ShopPreviewItem {
  const shop = item.shop_item || {}
  return {
    id: item.item_id || item.id,
    // The API no longer returns rows that name nothing, and the item_type is
    // still a readable last resort — but never the literal word "Item".
    name:
      item.item_name ||
      shop.name ||
      String(item.item_type || item.category || "item")
        .replace(/[_-]+/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase()),
    description: shop.description || "",
    price: shop.price || 0,
    price_coins: shop.price_coins || shop.price || 0,
    price_usd: shop.price_usd || 0,
    category: item.category || shop.category || item.item_type || "item",
    item_type: item.item_type || shop.item_type || "item",
    rarity: item.rarity || shop.rarity || "common",
    premium_only: shop.premium_only || false,
    item_data: item.item_data || shop.item_data || {},
    preview_data: item.preview_data || shop.preview_data || {},
    icon_url: shop.icon_url,
    preview_url: shop.preview_url,
  } as ShopPreviewItem
}

export function UserInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const fetchInventory = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/inventory", {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to fetch inventory")
      setInventory(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory")
    } finally {
      setLoading(false)
    }
  }, [user?.id, getAuthHeader])

  useEffect(() => { void fetchInventory() }, [fetchInventory])
  useInventoryRealtime(user?.id, () => { void fetchInventory() })

  /* ── Apply / remove ──────────────────────────────────────────────────── */
  const applyItem = async (item: InventoryItem) => {
    if (applying) return
    setApplying(item.id)
    try {
      const response = await fetch("/api/inventory/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ inventory_item_id: item.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to apply item")

      if (data.theme && typeof window !== "undefined") {
        localStorage.setItem("loop-3d-theme", data.theme.id)
        localStorage.setItem("loop-3d-custom-theme", JSON.stringify(data.theme))
        window.dispatchEvent(new CustomEvent("loop-theme-applied", { detail: data.theme }))
      }
      if (typeof window !== "undefined" && data.cosmetics) {
        window.dispatchEvent(new CustomEvent("loop-cosmetics-applied", { detail: data.cosmetics }))
      }
      await fetchInventory()
      toast({ title: "Equipped", description: `${item.item_name} is now active.` })
    } catch (err) {
      toast({ title: "Couldn't equip", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" })
    } finally {
      setApplying(null)
    }
  }

  const removeItem = async (item: InventoryItem) => {
    if (applying) return
    setApplying(item.id)
    try {
      const response = await fetch("/api/inventory/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ inventory_item_id: item.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to remove item")

      if (typeof window !== "undefined") {
        if (data.cleared_theme) {
          localStorage.removeItem("loop-3d-custom-theme")
          localStorage.removeItem("loop-3d-theme")
          window.dispatchEvent(new CustomEvent("loop-theme-applied", { detail: null }))
        }
        if (data.cosmetics) {
          window.dispatchEvent(new CustomEvent("loop-cosmetics-applied", { detail: data.cosmetics }))
        }
      }
      await fetchInventory()
      toast({ title: "Unequipped", description: `${item.item_name} removed.` })
    } catch (err) {
      toast({ title: "Couldn't unequip", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" })
    } finally {
      setApplying(null)
    }
  }

  /* ── Derived data ────────────────────────────────────────────────────── */
  const grouped = useMemo(() => {
    const map: Record<Shelf, InventoryItem[]> = { theme: [], effect: [], identity: [], coins: [], other: [] }
    for (const item of inventory) map[shelfFor(item)].push(item)
    return map
  }, [inventory])

  const activeItems = useMemo(() => inventory.filter((i) => i.is_active), [inventory])
  const activeByShelf = useMemo(() => {
    const map: Record<Shelf, InventoryItem[]> = { theme: [], effect: [], identity: [], coins: [], other: [] }
    for (const item of activeItems) map[shelfFor(item)].push(item)
    return map
  }, [activeItems])

  /* ── Not signed in ───────────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/70 bg-card p-16 text-center">
        <Lottie animation={LOCK} className="mb-4 h-16 w-16" />
        <h3 className="text-base font-semibold text-foreground">Sign in to see what you own</h3>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">Themes, frames, effects and badges you buy with Loop Coins live here.</p>
      </div>
    )
  }

  /* ── Loading ─────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-border bg-card/50 p-1">
              <div className="aspect-[4/3] rounded-xl bg-muted/40" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 rounded bg-muted/40" />
                <div className="h-2 w-1/2 rounded bg-muted/30" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Error ───────────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border/70 bg-card p-12 text-center">
        <p className="mb-3 text-sm text-destructive">{error}</p>
        <Button onClick={fetchInventory} variant="outline" size="sm" className="rounded-lg">Reload inventory</Button>
      </div>
    )
  }

  /* ── Inventory card ──────────────────────────────────────────────────── */
  function ItemCard({ item }: { item: InventoryItem }) {
    const shopItem = toShopItem(item)
    const rarity = (item.rarity || "common").toLowerCase()
    const style = RARITY_STYLE[rarity] || RARITY_STYLE.common
    const isActive = item.is_active
    const isApplying = applying === item.id

    return (
      <article
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors duration-150",
          isActive
            ? "border-primary/50 ring-1 ring-primary/15"
            : "border-border/70 hover:border-border",
        )}
      >
        {/* Rarity top accent */}
        <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent", style.edge)} />

        {/* Preview — live cosmetic render, same as the shop */}
        <div className="relative overflow-hidden border-b border-border bg-muted/20">
          <div className="aspect-[4/3] w-full">
            <ShopItemMiniPreview item={shopItem} className="py-3" />
          </div>

          {/* Rarity chip */}
          <span className="absolute left-2 top-2">
            <RarityChip rarity={rarity} />
          </span>

          {/* Active badge */}
          {isActive && (
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Check className="h-2.5 w-2.5" />
              Active
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-2.5 p-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{item.item_name}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {SHELF_META[shelfFor(item)].label}
              {item.acquired_at ? ` · ${new Date(item.acquired_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-auto flex items-center gap-2">
            {isActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeItem(item)}
                disabled={isApplying}
                className="flex-1 rounded-lg border-border/80 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {isApplying ? (
                  <Lottie animation={LOADER} className="h-3.5 w-3.5" />
                ) : (
                  <>
                    <X className="mr-1 h-3 w-3" />
                    Unequip
                  </>
                )}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => applyItem(item)}
                disabled={isApplying}
                className="flex-1 rounded-lg text-xs font-semibold"
              >
                {isApplying ? (
                  <Lottie animation={LOADER} className="h-3.5 w-3.5" />
                ) : (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Equip
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </article>
    )
  }

  /* ── Empty state per shelf ───────────────────────────────────────────── */
  function EmptyShelf({ shelf }: { shelf: Shelf }) {
    const meta = SHELF_META[shelf]
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/30 p-10 text-center">
        <Lottie animation={EMPTY_BOX} className="mb-3 h-12 w-12" />
        <p className="text-sm font-medium text-foreground">Nothing equipped from {meta.label.toLowerCase()} yet</p>
        <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{meta.hint}. Anything you buy appears here and can be equipped in one tap.</p>
        <Link href="/shop">
          <Button variant="outline" size="sm" className="mt-3 rounded-lg text-xs">
            <ShoppingBag className="mr-1.5 h-3 w-3" />
            Browse shop
          </Button>
        </Link>
      </div>
    )
  }

  /* ── Active items strip ──────────────────────────────────────────────── */
  function ActiveStrip() {
    if (activeItems.length === 0) return null
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Currently equipped</span>
          <Badge variant="secondary" className="ml-auto rounded-full px-2 py-0 text-[10px]">{activeItems.length}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeItems.map((item) => {
            const meta = SHELF_META[shelfFor(item)]
            return (
              <button
                key={item.id}
                onClick={() => removeItem(item)}
                disabled={applying === item.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-150 hover:border-border hover:bg-muted disabled:opacity-50"
              >
                {meta.icon}
                <span className="max-w-[120px] truncate">{item.item_name}</span>
                <X className="h-3 w-3 opacity-50" />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  /* ── Shelf grid ──────────────────────────────────────────────────────── */
  function ShelfGrid({ shelf }: { shelf: Shelf }) {
    const items = grouped[shelf]
    if (items.length === 0) return <EmptyShelf shelf={shelf} />
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => <ItemCard key={item.id} item={item} />)}
      </div>
    )
  }

  /* ── Main render ─────────────────────────────────────────────────────── */
  const totalByShelf = (Object.keys(grouped) as Shelf[]).filter((s) => grouped[s].length > 0)

  return (
    <div className="space-y-5">
      {/* User header + stats */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3.5">
          <VideoAvatar src={user?.avatar_url} className="h-14 w-14 border-2 border-border shadow-md" fallback={user?.display_name?.charAt(0)} />
          <div>
            <h2 className="text-lg font-bold text-foreground">{user?.display_name}</h2>
            <p className="text-xs text-muted-foreground">@{user?.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5">
            <Coins className="h-4 w-4 text-[hsl(var(--warning))]" />
            <span className="loop-stat text-sm font-semibold text-foreground">{Number(user?.loop_coins || 0).toLocaleString()}</span>
          </div>
          <Link href="/shop">
            <Button size="sm" className="rounded-lg text-xs font-semibold">
              <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
              Shop
            </Button>
          </Link>
        </div>
      </div>

      {/* Active items strip */}
      <ActiveStrip />

      {/* Profile frames are sold in the shop and worn from here, so they belong
          on this page too — an avatar ring nobody can find is not an inventory. */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-0.5">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Profile frames</span>
        </div>
        <ProfileFramesPanel ownedOnly compact avatarUrl={user?.avatar_url} />
      </section>

      {/* Empty state */}
      {inventory.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/30 py-20 text-center">
          <Lottie animation={EMPTY_BOX} className="mb-4 h-20 w-20" />
          <h3 className="text-base font-semibold text-foreground">You haven&apos;t bought anything yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Themes, card effects, frames and badges are bought with Loop Coins in the shop, then equipped from here.</p>
          <Link href="/shop">
            <Button className="mt-5 rounded-lg text-sm font-semibold">
              <ShoppingBag className="mr-2 h-4 w-4" />
              Visit Shop
            </Button>
          </Link>
        </div>
      ) : (
        <Tabs defaultValue={totalByShelf[0] || "theme"} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl border border-border/70 bg-card p-1.5 sm:grid-cols-6">
            <TabsTrigger value="all" className="rounded-xl text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background text-muted-foreground transition-all">
              All <span className="ml-1 text-[10px] opacity-60">{inventory.length}</span>
            </TabsTrigger>
            {(Object.keys(SHELF_META) as Shelf[]).map((shelf) => {
              const meta = SHELF_META[shelf]
              const count = grouped[shelf].length
              if (count === 0) return null
              return (
                <TabsTrigger key={shelf} value={shelf} className="rounded-xl text-xs font-semibold data-[state=active]:bg-foreground data-[state=active]:text-background text-muted-foreground transition-all">
                  <span className="hidden sm:inline">{meta.label}</span>
                  <span className="sm:hidden">{meta.icon}</span>
                  <span className="ml-1 text-[10px] opacity-60">{count}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {/* All tab */}
          <TabsContent value="all" className="mt-4 space-y-4">
            {totalByShelf.map((shelf) => (
              <div key={shelf}>
                <div className="mb-2 flex items-center gap-2 px-0.5">
                  {SHELF_META[shelf].icon}
                  <span className="text-sm font-semibold text-foreground">{SHELF_META[shelf].label}</span>
                  <span className="text-[11px] text-muted-foreground">{grouped[shelf].length} items</span>
                </div>
                <ShelfGrid shelf={shelf} />
              </div>
            ))}
          </TabsContent>

          {/* Per-shelf tabs */}
          {(Object.keys(SHELF_META) as Shelf[]).map((shelf) => (
            <TabsContent key={shelf} value={shelf} className="mt-4">
              <ShelfGrid shelf={shelf} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
