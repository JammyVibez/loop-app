"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowDownUp,
  Coins,
  LayoutGrid,
  Package,
  Palette,
  Search,
  SlidersHorizontal,
  Sparkle,
  UserRound,
  Wand2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useInventoryRealtime } from "@/hooks/use-inventory-realtime"
import { cn } from "@/lib/utils"
import {
  ShopItemPreviewDialog,
  type ShopPreviewItem,
} from "@/components/shop/shop-item-preview"
import { LoopCoinsBalance } from "@/components/shop/loop-coins-balance"
import { ShopItemCard, RarityChip } from "@/components/shop/shop-item-card"
import {
  SHOP_SORTS,
  coinPrice,
  matchesQuery,
  shopBucket,
  sortShopItems,
  type ShopCatalogItem,
  type ShopSortId,
} from "@/lib/shop-catalog"
import { ShopEmpty, ShopError, ShopLoading } from "@/components/shop/shop-states"
import { PurchaseCelebration, type CelebrationPayload } from "@/components/shop/purchase-celebration"
import { ShopHero } from "@/components/shop/shop-hero"
import { ProfileFramesPanel } from "@/components/profile/pfp-frames-panel"
import { GIFT, SPARKLES } from "@/components/shop/shop-art"
import { Lottie } from "@/components/ui/lottie"

type ShopItem = ShopCatalogItem

type SortId = ShopSortId

interface CategoryDef {
  id: string
  label: string
  icon: LucideIcon
  hint: string
  match?: (item: ShopPreviewItem) => boolean
  /** Hidden while it has nothing in it. */
  hideWhenEmpty?: boolean
  /** Rendered by its own component instead of the item grid. */
  custom?: boolean
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "featured",
    label: "Everything",
    icon: LayoutGrid,
    hint: "The whole shop, rarest first.",
  },
  {
    id: "theme",
    label: "Themes",
    icon: Palette,
    hint: "Repaint the whole app — feed, chat, profile and all.",
    match: (item) => shopBucket(item) === "theme",
  },
  {
    id: "effect",
    label: "Frames & effects",
    icon: Zap,
    hint: "Rings, auras and post treatments that follow you around.",
    match: (item) => shopBucket(item) === "effect",
  },
  {
    id: "identity",
    label: "Name & badges",
    icon: UserRound,
    hint: "Display fonts, badges and nameplates.",
    match: (item) => shopBucket(item) === "identity",
  },
  {
    id: "coins",
    label: "Loop Coins",
    icon: Coins,
    hint: "Top up, or earn them for free.",
    match: (item) => shopBucket(item) === "coins",
  },
  {
    id: "frames",
    label: "Profile frames",
    icon: Sparkle,
    hint: "Rings you collect and wear on your avatar.",
    custom: true,
  },
  {
    id: "other",
    label: "More",
    icon: Package,
    hint: "Everything else on the shelves.",
    match: (item) => shopBucket(item) === "other",
    hideWhenEmpty: true,
  },
]

/** How many cards mount at once. The rest wait behind "Show more". */
const PAGE_SIZE = 24

export function ShopContent() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [category, setCategory] = useState<string>("featured")
  const [rarity, setRarity] = useState<string>("all")
  const [sort, setSort] = useState<SortId>("featured")
  const [search, setSearch] = useState("")
  const [hideOwned, setHideOwned] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [preview, setPreview] = useState<ShopPreviewItem | null>(null)
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const { toast } = useToast()
  const { user, getAuthHeader, refreshUser } = useAuth()

  const loadItems = useCallback(async () => {
    setStatus("loading")
    try {
      const response = await fetch("/api/shop/items")
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Shop unavailable")
      setItems(Array.isArray(data.items) ? data.items : [])
      setStatus("ready")
    } catch (error) {
      console.error("Error fetching shop items:", error)
      setStatus("error")
    }
  }, [])

  const loadInventory = useCallback(async () => {
    if (!user) {
      setOwnedIds(new Set())
      return
    }
    try {
      const response = await fetch("/api/inventory", { headers: { ...getAuthHeader() } })
      const data = await response.json()
      if (data.success) {
        setOwnedIds(new Set<string>(data.items.map((item: { item_id: string }) => item.item_id)))
      }
    } catch (error) {
      console.error("Error fetching inventory:", error)
    }
  }, [user, getAuthHeader])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  // Purchases made anywhere — another tab, an admin grant, a Stripe webhook —
  // flip the "Owned" state here without a reload.
  useInventoryRealtime(user?.id, () => {
    void loadInventory()
  })

  // Deep links (e.g. the inventory's "Browse frames in the shop") open on a shelf.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("category")
    if (requested && CATEGORIES.some((def) => def.id === requested)) setCategory(requested)
  }, [])

  // Stripe Checkout sends card payers back here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkout = params.get("checkout")
    if (!checkout) return
    if (checkout === "success") {
      toast({
        title: "Payment complete",
        description: "Your purchase lands in Inventory the moment Stripe confirms it.",
      })
      window.setTimeout(() => void loadInventory(), 2500)
    } else if (checkout === "cancelled") {
      toast({ title: "Checkout cancelled", description: "Nothing was charged." })
    }
    window.history.replaceState({}, "", window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePurchase = async (item: ShopPreviewItem, method: "coins" | "stripe" = "coins") => {
    if (!user) {
      toast({
        title: "Sign in to buy",
        description: "Your purchases are tied to your account.",
        variant: "destructive",
      })
      return
    }

    const isCoinPack = item.category === "coins"

    if (ownedIds.has(item.id) && !isCoinPack) {
      toast({ title: "Already owned", description: "You'll find it in your inventory." })
      return
    }

    if (item.premium_only && !user.is_premium) {
      toast({
        title: "Pro members only",
        description: "This one is part of Loop Pro.",
        variant: "destructive",
      })
      return
    }

    const price = coinPrice(item)
    const useStripe = isCoinPack || method === "stripe"

    if (!useStripe && (user.loop_coins || 0) < price) {
      toast({
        title: "Not enough Loop Coins",
        description: `You need ${(price - (user.loop_coins || 0)).toLocaleString()} more. Earn them in Quests, or top up.`,
        variant: "destructive",
      })
      return
    }

    setPurchasing(item.id)
    try {
      const response = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          item_id: item.id,
          payment_method: useStripe ? "stripe" : "coins",
        }),
      })
      const data = await response.json()

      if (data.success && data.checkout_url) {
        window.location.href = data.checkout_url
        return
      }

      if (!data.success) {
        toast({
          title: "That didn't go through",
          description: data.error || "Nothing was charged.",
          variant: "destructive",
        })
        return
      }

      setOwnedIds((prev) => new Set([...prev, item.id]))
      setCelebration({
        name: item.name,
        rarity: item.rarity,
        coins: isCoinPack ? Number(item.item_data?.coins_amount || 0) + Number(item.item_data?.bonus || 0) : undefined,
        hasInventoryEntry: !isCoinPack,
      })
      await refreshUser?.()
      await loadInventory()
    } catch (error) {
      console.error("Error purchasing item:", error)
      toast({
        title: "That didn't go through",
        description: "Nothing was charged — try again.",
        variant: "destructive",
      })
    } finally {
      setPurchasing(null)
    }
  }

  // A filter change means a different list, so start it from the top again.
  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [category, rarity, sort, search, hideOwned])

  const activeCategory = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0]

  const inCategory = useMemo(() => {
    if (!activeCategory.match) return items
    return items.filter(activeCategory.match)
  }, [items, activeCategory])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const def of CATEGORIES) {
      if (def.custom) continue
      map.set(def.id, def.match ? items.filter(def.match).length : items.length)
    }
    return map
  }, [items])

  const filtered = useMemo(() => {
    const list = inCategory.filter((item) => {
      if (rarity !== "all" && (item.rarity || "").toLowerCase() !== rarity) return false
      if (hideOwned && ownedIds.has(item.id) && item.category !== "coins") return false
      return matchesQuery(item, search)
    })
    return sortShopItems(list, sort)
  }, [inCategory, rarity, hideOwned, ownedIds, search, sort])

  const spotlight = useMemo(
    () =>
      sortShopItems(
        items.filter((item) => ["legendary", "epic"].includes((item.rarity || "").toLowerCase())),
        "featured",
      ).slice(0, 6),
    [items],
  )

  const isFiltered = rarity !== "all" || Boolean(search.trim()) || hideOwned

  const clearFilters = () => {
    setRarity("all")
    setSearch("")
    setHideOwned(false)
    setSort("featured")
  }

  const card = (item: ShopItem, className?: string) => (
    <ShopItemCard
      key={item.id}
      item={item}
      className={className}
      owned={ownedIds.has(item.id)}
      purchasing={purchasing === item.id}
      locked={Boolean(item.premium_only && !user?.is_premium)}
      onPreview={setPreview}
      onBuy={(next) => void handlePurchase(next)}
      onBuyWithCard={(next) => void handlePurchase(next, "stripe")}
    />
  )

  return (
    <div className="space-y-6 pb-24 sm:pb-10">
      <ShopHero
        coins={user ? user.loop_coins || 0 : null}
        ownedCount={ownedIds.size}
        availableCount={items.length}
        onBrowseCoins={() => setCategory("coins")}
        onBrowseAll={() => {
          clearFilters()
          setCategory("featured")
        }}
      />

      {status === "error" ? (
        <ShopError onRetry={() => void loadItems()} />
      ) : status === "loading" ? (
        <ShopLoading />
      ) : (
        <>
          {/* Category rail */}
          <nav className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max items-center gap-1.5 rounded-full border border-border bg-card p-1">
              {CATEGORIES.filter((def) => !def.hideWhenEmpty || (counts.get(def.id) || 0) > 0).map((def) => {
                const Icon = def.icon
                const active = def.id === category
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => setCategory(def.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {def.label}
                    {counts.has(def.id) ? (
                      <span className={cn("tabular-nums", active ? "opacity-60" : "opacity-50")}>
                        {counts.get(def.id)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </nav>

          {activeCategory.custom ? (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Sparkle className="h-3 w-3" />
                  {activeCategory.hint}
                </span>
              </div>
              <ProfileFramesPanel avatarUrl={user?.avatar_url} />
            </section>
          ) : activeCategory.id === "coins" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{filtered.map((item) => card(item))}</div>
              <div className="space-y-4">
                <LoopCoinsBalance showDetails />
                <div className="rounded-2xl border border-border bg-card p-5">
                  <Lottie animation={GIFT} className="h-16 w-16" />
                  <h3 className="mt-2 text-sm font-semibold text-foreground">Coins you don&apos;t pay for</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Daily check-ins, quests and tips from other people all pay out in Loop Coins. Quests
                    reset every day.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3 rounded-full">
                    <Link href="/quests">Open Quests</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {spotlight.length > 0 && !isFiltered && activeCategory.id === "featured" ? (
                <section className="space-y-3">
                  <header className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Lottie animation={SPARKLES} className="h-6 w-6" />
                      <h2 className="text-sm font-semibold text-foreground">Spotlight</h2>
                      <span className="text-xs text-muted-foreground">the rarest things here</span>
                    </div>
                  </header>
                  <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="flex w-max gap-3">
                      {spotlight.map((item) => card(item, "w-[248px] shrink-0"))}
                    </div>
                  </div>
                </section>
              ) : null}

              {/* Filters */}
              <section className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search themes, frames, effects…"
                      className="h-9 rounded-full pl-9 text-sm"
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full md:hidden"
                    onClick={() => setFiltersOpen((open) => !open)}
                  >
                    <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                    Filters
                    {isFiltered ? <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                  </Button>

                  <div className={cn("flex-wrap items-center gap-2", filtersOpen ? "flex" : "hidden md:flex")}>
                    <Select value={rarity} onValueChange={setRarity}>
                      <SelectTrigger className="h-9 w-[130px] rounded-full text-sm">
                        <SelectValue placeholder="Rarity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All rarities</SelectItem>
                        <SelectItem value="legendary">Legendary</SelectItem>
                        <SelectItem value="epic">Epic</SelectItem>
                        <SelectItem value="rare">Rare</SelectItem>
                        <SelectItem value="common">Common</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={sort} onValueChange={(value) => setSort(value as SortId)}>
                      <SelectTrigger className="h-9 w-[170px] rounded-full text-sm">
                        <ArrowDownUp className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHOP_SORTS.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex h-9 items-center gap-2 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground">
                      <Switch checked={hideOwned} onCheckedChange={setHideOwned} />
                      Hide owned
                    </div>

                    {isFiltered ? (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkle className="h-3 w-3" />
                    {activeCategory.hint}
                  </span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">
                    {filtered.length} {filtered.length === 1 ? "item" : "items"}
                  </span>
                  {rarity !== "all" ? (
                    <>
                      <span aria-hidden>·</span>
                      <RarityChip rarity={rarity} />
                    </>
                  ) : null}
                </div>
              </section>

              {filtered.length === 0 ? (
                <ShopEmpty
                  title={items.length === 0 ? "The shelves are empty" : "Nothing matches those filters"}
                  hint={
                    items.length === 0
                      ? "New items land here first — check back soon, or earn coins in the meantime."
                      : "Try a different rarity, or clear the filters to see the whole shop."
                  }
                  action={
                    isFiltered ? (
                      <Button variant="outline" className="rounded-full" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.slice(0, limit).map((item) => card(item))}
                  </div>
                  {filtered.length > limit ? (
                    <div className="flex justify-center pt-1">
                      <Button
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setLimit((current) => current + PAGE_SIZE)}
                      >
                        Show {Math.min(PAGE_SIZE, filtered.length - limit)} more
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}

          {/* One quiet line for anyone who does not know how any of this works. */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
                <Wand2 className="h-4 w-4 text-violet-500" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">How it works</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Preview live, buy once with coins or a card, then equip it from Inventory. Unequipping
                  never costs anything.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-full">
                <Link href="/inventory">Inventory</Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="rounded-full">
                <Link href="/quests">Earn coins</Link>
              </Button>
            </div>
          </div>
        </>
      )}

      <ShopItemPreviewDialog
        item={preview}
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
        owned={preview ? ownedIds.has(preview.id) : false}
        locked={Boolean(preview?.premium_only && !user?.is_premium)}
        onPurchase={(item) => {
          setPreview(null)
          void handlePurchase(item)
        }}
      />

      <PurchaseCelebration payload={celebration} onClose={() => setCelebration(null)} />
    </div>
  )
}
