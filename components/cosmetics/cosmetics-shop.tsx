"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Crown,
  Sparkles,
  Frame,
  Layers,
  Type,
  Paintbrush,
  Gem,
  Check,
  Lock,
  Star,
  Zap,
  ShoppingCart,
  X,
} from "lucide-react"
import { toast } from "sonner"

type CosmeticCategory = "profile_decoration" | "profile_effect" | "post_decoration" | "post_effect" | "nameplate" | "display_name_theme"

interface CatalogItem {
  id: string
  name: string
  description: string | null
  category: CosmeticCategory
  item_type: string
  rarity: string
  price_coins: number
  price_premium: boolean
  preview_url: string | null
  asset_url: string | null
  thumbnail_url: string | null
  icon_url: string | null
  color: string | null
  glow_color: string | null
  is_premium_only: boolean
  item_data: Record<string, any>
}

const CATEGORY_META: Record<CosmeticCategory, { label: string; icon: typeof Crown; description: string }> = {
  profile_decoration: {
    label: "Avatar Frames",
    icon: Frame,
    description: "Transparent frames that overlay your profile picture",
  },
  profile_effect: {
    label: "Avatar Effects",
    icon: Sparkles,
    description: "Animated auras and particle effects around your avatar",
  },
  post_decoration: {
    label: "Post Frames",
    icon: Layers,
    description: "Themed borders and graphics around your posts",
  },
  post_effect: {
    label: "Post Effects",
    icon: Paintbrush,
    description: "Subtle background animations behind your post content",
  },
  nameplate: {
    label: "Nameplates",
    icon: Crown,
    description: "Custom banners and backgrounds for your username",
  },
  display_name_theme: {
    label: "Display Themes",
    icon: Type,
    description: "Custom fonts, colors, and gradients for your display name",
  },
}

const RARITY_COLORS: Record<string, string> = {
  common: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  rare: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  epic: "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20",
  legendary: "bg-amber-500/10 text-amber-500 border-amber-500/20",
}

const RARITY_RING: Record<string, string> = {
  common: "",
  rare: "ring-2 ring-sky-400/50",
  epic: "ring-2 ring-fuchsia-400/50 shadow-[0_0_12px_rgba(232,121,249,0.3)]",
  legendary: "ring-2 ring-amber-400/50 shadow-[0_0_16px_rgba(251,191,36,0.4)]",
}

export function CosmeticsShop() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [inventory, setInventory] = useState<string[]>([]) // item IDs user owns
  const [equipped, setEquipped] = useState<Record<CosmeticCategory, string | null>>({
    profile_decoration: null,
    profile_effect: null,
    post_decoration: null,
    post_effect: null,
    nameplate: null,
    display_name_theme: null,
  })
  const [loading, setLoading] = useState(true)
  const [previewItem, setPreviewItem] = useState<CatalogItem | null>(null)
  const [activeCategory, setActiveCategory] = useState<CosmeticCategory>("profile_decoration")

  const fetchCosmetics = useCallback(async () => {
    try {
      const headers = getAuthHeader()
      const res = await fetch("/api/cosmetics", { headers })
      const data = await res.json()
      if (data.success) {
        setCatalog(data.catalog || [])
        if (data.user) {
          setInventory(data.user.inventory?.map((i: any) => i.item_id) || [])
          const equippedMap: Record<CosmeticCategory, string | null> = {
            profile_decoration: null,
            profile_effect: null,
            post_decoration: null,
            post_effect: null,
            nameplate: null,
            display_name_theme: null,
          }
          for (const item of data.user.equipped || []) {
            equippedMap[item.category as CosmeticCategory] = item.item_id
          }
          setEquipped(equippedMap)
        }
      }
    } catch (err) {
      console.error("Failed to fetch cosmetics:", err)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    fetchCosmetics()
  }, [fetchCosmetics])

  const handleEquip = async (category: CosmeticCategory, itemId: string | null) => {
    try {
      const headers = { ...getAuthHeader(), "Content-Type": "application/json" }
      const action = equipped[category] === itemId ? "unequip" : "equip"
      const res = await fetch("/api/cosmetics/equip", {
        method: "POST",
        headers,
        body: JSON.stringify({ action, category, itemId: action === "unequip" ? undefined : itemId }),
      })
      const data = await res.json()
      if (data.success) {
        setEquipped((prev) => ({
          ...prev,
          [category]: action === "unequip" ? null : itemId,
        }))
        toast.success(action === "unequip" ? "Unequipped!" : "Equipped!")
        // Dispatch event for live preview
        window.dispatchEvent(new CustomEvent("loop-cosmetics-applied", { detail: { category, itemId } }))
      } else {
        toast.error(data.error || "Failed to update")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update cosmetics")
    }
  }

  const filteredCatalog = catalog.filter((item) => item.category === activeCategory)
  const ownedItems = filteredCatalog.filter((item) => inventory.includes(item.id))
  const shopItems = filteredCatalog.filter((item) => !inventory.includes(item.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading cosmetics shop…</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <Gem className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold">Cosmetics Shop</h3>
          <p className="text-sm text-muted-foreground">Customize your profile and posts</p>
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as CosmeticCategory)}>
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1 bg-muted/50">
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const Icon = meta.icon
            const count = catalog.filter((i) => i.category === key).length
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="flex items-center gap-1.5 text-xs px-3 py-2 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{meta.label}</span>
                <span className="text-[10px] opacity-60">({count})</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {/* Category Description */}
        <p className="text-xs text-muted-foreground mt-2">
          {CATEGORY_META[activeCategory].description}
        </p>

        <TabsContent value={activeCategory} className="mt-4">
          {/* Currently Equipped */}
          {equipped[activeCategory] && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Currently Equipped
              </h4>
              {(() => {
                const item = catalog.find((i) => i.id === equipped[activeCategory])
                if (!item) return null
                return (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="flex items-center gap-3 p-3">
                      <ItemPreview item={item} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.rarity}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEquip(activeCategory, item.id)}
                        className="shrink-0"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    </CardContent>
                  </Card>
                )
              })()}
            </div>
          )}

          {/* Owned Items */}
          {ownedItems.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Your Collection ({ownedItems.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ownedItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isEquipped={equipped[activeCategory] === item.id}
                    isOwned={true}
                    onEquip={() => handleEquip(activeCategory, item.id)}
                    onPreview={() => setPreviewItem(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Shop Items */}
          {shopItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                <ShoppingCart className="inline h-3 w-3 mr-1" />
                Available in Shop ({shopItems.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {shopItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isEquipped={false}
                    isOwned={false}
                    onEquip={() => handleEquip(activeCategory, item.id)}
                    onPreview={() => setPreviewItem(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredCatalog.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Gem className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No items in this category yet</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      {previewItem && (
        <Dialog open={Boolean(previewItem)} onOpenChange={() => setPreviewItem(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ItemPreview item={previewItem} size="sm" />
                {previewItem.name}
              </DialogTitle>
              <DialogDescription>{previewItem.description}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className={cn("capitalize", RARITY_COLORS[previewItem.rarity])}>
                <Star className="h-3 w-3 mr-1" />
                {previewItem.rarity}
              </Badge>
              {previewItem.is_premium_only && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                  <Crown className="h-3 w-3 mr-1" />
                  Premium Only
                </Badge>
              )}
              {!previewItem.is_premium_only && previewItem.price_coins > 0 && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  <Zap className="h-3 w-3 mr-1" />
                  {previewItem.price_coins.toLocaleString()} coins
                </Badge>
              )}
            </div>
            <DialogFooter>
              {inventory.includes(previewItem.id) ? (
                <Button
                  onClick={() => {
                    handleEquip(previewItem.category as CosmeticCategory, previewItem.id)
                    setPreviewItem(null)
                  }}
                >
                  {equipped[previewItem.category as CosmeticCategory] === previewItem.id ? "Unequip" : "Equip"}
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <Lock className="h-3.5 w-3.5 mr-1" />
                  Not Owned
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────── */

function ItemCard({
  item,
  isEquipped,
  isOwned,
  onEquip,
  onPreview,
}: {
  item: CatalogItem
  isEquipped: boolean
  isOwned: boolean
  onEquip: () => void
  onPreview: () => void
}) {
  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-md",
        isEquipped && "ring-2 ring-primary shadow-md",
        !isOwned && "opacity-80"
      )}
      onClick={onPreview}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <ItemPreview item={item} size="md" />
          {isEquipped && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3 w-3" />
            </div>
          )}
        </div>
        <p className="text-xs font-semibold truncate">{item.name}</p>
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0", RARITY_COLORS[item.rarity])}
          >
            {item.rarity}
          </Badge>
          {item.is_premium_only && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500 border-amber-500/20">
              Pro
            </Badge>
          )}
        </div>
        {isOwned && !isEquipped && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation()
              onEquip()
            }}
          >
            Equip
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function ItemPreview({ item, size = "sm" }: { item: CatalogItem; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-20 w-20",
  }

  if (item.thumbnail_url || item.icon_url || item.preview_url) {
    return (
      <div
        className={cn("relative rounded-xl overflow-hidden", sizeClasses[size], RARITY_RING[item.rarity])}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnail_url || item.icon_url || item.preview_url || ""}
          alt={item.name}
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  // Fallback: colored circle with first letter
  return (
    <div
      className={cn(
        "relative rounded-xl flex items-center justify-center font-bold text-white",
        sizeClasses[size],
        RARITY_RING[item.rarity]
      )}
      style={{
        background: `linear-gradient(135deg, ${item.color || "#8b5cf6"}, ${item.glow_color || item.color || "#6366f1"})`,
      }}
    >
      <span className={cn(size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs")}>
        {item.name.charAt(0)}
      </span>
    </div>
  )
}
