"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Palette, Zap, Crown, Star, Loader2, Eye, CreditCard } from "lucide-react";
import { LoopCoinsBalance } from "@/components/shop/loop-coins-balance";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useInventoryRealtime } from "@/hooks/use-inventory-realtime";
import { ShopItemMiniPreview, ShopItemPreviewDialog, type ShopPreviewItem } from "@/components/shop/shop-item-preview";
import { CosmeticsShop } from "@/components/cosmetics/cosmetics-shop";
import { Gem } from "lucide-react";

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  price_coins?: number | null
  price_usd?: number | null
  category: string
  item_type: string
  rarity: string
  premium_only: boolean
  item_data: any
  preview_data?: any
  is_active: boolean
}

interface ShopItems {
  themes: ShopItem[]
  animations: ShopItem[]
  effects: ShopItem[]
  coins: ShopItem[]
}

const rarityColors = {
  common: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  rare: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  epic: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  legendary: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
}

export function ShopContent() {
  const [shopItems, setShopItems] = useState<ShopItems>({
    themes: [],
    animations: [],
    effects: [],
    coins: [],
  })
  const [purchasedItems, setPurchasedItems] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [previewItem, setPreviewItem] = useState<ShopPreviewItem | null>(null)
  const { toast } = useToast()
  const { user, getAuthHeader, refreshUser } = useAuth()

  useEffect(() => {
    fetchShopItems()
    if (user) {
      fetchUserInventory()
    }
  }, [user?.id])

  // Live inventory: purchases made anywhere (this tab, another tab, an admin
  // grant, a Stripe webhook) flip the "Owned" state instantly.
  useInventoryRealtime(user?.id, () => {
    void fetchUserInventory()
  })

  // Stripe Checkout success/cancel for card-paid items lands back here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get("checkout")
    if (!status) return
    if (status === "success") {
      toast({ title: "Payment complete 🎉", description: "Your purchase will appear in Inventory in a few seconds." })
      if (user) {
        // Grant arrives via the Stripe webhook — poll briefly, then refresh.
        window.setTimeout(() => void fetchUserInventory(), 2500)
      }
    } else if (status === "cancelled") {
      toast({ title: "Checkout cancelled", description: "No charge was made." })
    }
    window.history.replaceState({}, "", window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchShopItems = async () => {
    try {
      const response = await fetch("/api/shop/items")
      const data = await response.json()

      if (data.success) {
        const categorizedItems: ShopItems = {
          themes: [],
          animations: [],
          effects: [],
          coins: [],
        }

        data.items.forEach((item: ShopItem) => {
          const category = item.category
          if (category === "theme") categorizedItems.themes.push(item)
          else if (category === "animation") categorizedItems.animations.push(item)
          else if (category === "effect" || category === "card_effect") categorizedItems.effects.push(item)
          else if (category === "coins") categorizedItems.coins.push(item)
          else if (category === "avatar" || category === "badge" || category === "premium" || category === "font") {
            categorizedItems.effects.push(item)
          }
        })

        setShopItems(categorizedItems)
      }
    } catch (error) {
      console.error("Error fetching shop items:", error)
      toast({
        title: "Error",
        description: "Failed to load shop items",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchUserInventory = async () => {
    if (!user) return

    try {
      const response = await fetch("/api/inventory", {
        headers: { ...getAuthHeader() },
      })
      const data = await response.json()

      if (data.success) {
        const ownedItemIds = new Set<string>(data.items.map((item: any) => item.item_id))
        setPurchasedItems(ownedItemIds)
      }
    } catch (error) {
      console.error("Error fetching inventory:", error)
    }
  }

  const handlePurchase = async (item: ShopItem | ShopPreviewItem, method: "coins" | "stripe" = "coins") => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to make purchases.",
        variant: "destructive",
      })
      return
    }

    if (purchasedItems.has(item.id) && item.category !== "coins") {
      toast({
        title: "Already Owned",
        description: "You already own this item!",
        variant: "destructive",
      })
      return
    }

    if (item.premium_only && !user?.is_premium) {
      toast({
        title: "Premium Required",
        description: "This item is exclusive to Premium members. Upgrade to access!",
        variant: "destructive",
      })
      return
    }

    setPurchasing(item.id)

    try {
      const isCoinPack = item.category === "coins"
      const useStripe = isCoinPack || method === "stripe"

      if (!useStripe) {
        const itemPrice = Number(item.price_coins ?? item.price ?? 0)
        if ((user?.loop_coins || 0) < itemPrice) {
          toast({
            title: "Insufficient Loop Coins",
            description: "You don't have enough Loop Coins for this purchase.",
            variant: "destructive",
          })
          setPurchasing(null)
          return
        }
      }

      const response = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          item_id: item.id,
          payment_method: useStripe ? "stripe" : "coins",
        }),
      })

      const data = await response.json()

      if (data.success && useStripe && data.checkout_url) {
        // Redirect to Stripe Checkout — coins/items are granted by the webhook once payment succeeds.
        window.location.href = data.checkout_url
        return
      }

      if (data.success) {
        setPurchasedItems((prev) => new Set([...prev, item.id]))
        toast({
          title: "Purchase Successful!",
          description: `You've purchased ${item.name}. Open Inventory to apply themes & effects.`,
        })
        await refreshUser?.()
        await fetchUserInventory()
        window.setTimeout(() => {
          toast({
            title: "Activate in Inventory",
            description: "Profile menu → Inventory, or go to /inventory",
          })
        }, 1200)
      } else {
        toast({
          title: "Purchase Failed",
          description: data.error || "Failed to complete purchase",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error purchasing item:", error)
      toast({
        title: "Purchase Failed",
        description: "An error occurred while processing your purchase",
        variant: "destructive",
      })
    } finally {
      setPurchasing(null)
    }
  }

  const renderItemCard = (item: ShopItem) => (
    <Card key={item.id} className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{item.name}</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge className={rarityColors[item.rarity as keyof typeof rarityColors]}>{item.rarity}</Badge>
            {item.premium_only && (
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live preview — the actual effect running, not a static emoji */}
        <div className="relative h-24 overflow-hidden rounded-xl border border-border bg-muted/40">
          <ShopItemMiniPreview item={item} className="h-full" />
          <button
            type="button"
            onClick={() => setPreviewItem(item)}
            className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/40 via-transparent to-transparent pb-1 text-[10px] font-semibold text-white opacity-0 transition hover:opacity-100"
          >
            <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
              <Eye className="h-3 w-3" /> Preview
            </span>
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {item.category === "coins" ? (
              <>
                <span className="font-bold text-lg text-green-600">${item.price_usd || item.price}</span>
                <span className="text-sm text-gray-500">USD</span>
              </>
            ) : (
              <>
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-lg text-purple-600">{item.price || item.price_coins}</span>
                <span className="text-sm text-gray-500">Loop Coins</span>
              </>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => setPreviewItem(item)}
            className="mr-2 rounded-full"
            title="See a live preview before buying"
          >
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
          <Button
            onClick={() => handlePurchase(item)}
            disabled={purchasedItems.has(item.id) || purchasing === item.id}
            className={
              purchasedItems.has(item.id)
                ? "bg-green-500 hover:bg-green-600"
                : item.category === "coins" ?"bg-green-600 hover:bg-green-700" :"bg-gradient-to-r from-purple-500 to-blue-500"
            }
          >
            {purchasing === item.id ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : purchasedItems.has(item.id) ? (
              "Owned"
            ) : item.category === "coins" ? (
              "Buy Now"
            ) : (
              "Purchase"
            )}
          </Button>
          {item.category !== "coins" && !purchasedItems.has(item.id) && Number(item.price_usd) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePurchase(item, "stripe")}
              disabled={purchasing === item.id}
              className="rounded-full text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400"
              title={`Pay $${Number(item.price_usd).toFixed(2)} with card`}
            >
              <CreditCard className="mr-1 h-3.5 w-3.5" />
              ${Number(item.price_usd).toFixed(2)}
            </Button>
          )}
        </div>

        {item.item_data?.bonus && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
            <span className="text-sm text-green-700 dark:text-green-300 font-medium">
              +{item.item_data.bonus} bonus coins included!
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading shop items...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ShopItemPreviewDialog
        item={previewItem}
        open={Boolean(previewItem)}
        onOpenChange={(open) => { if (!open) setPreviewItem(null) }}
        owned={previewItem ? purchasedItems.has(previewItem.id) : false}
        onPurchase={(item) => { setPreviewItem(null); void handlePurchase(item) }}
      />
      {/* Coins Balance */}
      <div className="flex justify-center">
        <LoopCoinsBalance showDetails={true} />
      </div>

      {/* Shop Items */}
      <Tabs defaultValue="themes" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="themes" className="flex items-center space-x-2">
            <Palette className="w-4 h-4" />
            <span>Themes</span>
          </TabsTrigger>
          <TabsTrigger value="animations" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Animations</span>
          </TabsTrigger>
          <TabsTrigger value="effects" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Effects</span>
          </TabsTrigger>
          <TabsTrigger value="cosmetics" className="flex items-center space-x-2">
            <Gem className="w-4 h-4" />
            <span>Cosmetics</span>
          </TabsTrigger>
          <TabsTrigger value="coins" className="flex items-center space-x-2">
            <Coins className="w-4 h-4" />
            <span>Coins</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="themes" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shopItems.themes.map(renderItemCard)}
          </div>
        </TabsContent>

        <TabsContent value="animations" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shopItems.animations.map(renderItemCard)}
          </div>
        </TabsContent>

        <TabsContent value="effects" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shopItems.effects.map(renderItemCard)}
          </div>
        </TabsContent>

        <TabsContent value="cosmetics" className="mt-6">
          <CosmeticsShop />
        </TabsContent>

        <TabsContent value="coins" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shopItems.coins.map(renderItemCard)}
          </div>

          <Card className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
            <CardContent className="p-6 text-center">
              <Star className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Weekly Coin Bonus!</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                All users receive 500 free Loop Coins every week. Check back regularly!
              </p>
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Next bonus in 3 days
              </Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
