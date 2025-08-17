"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Coins, Palette, Sparkles, Zap, Crown, Star, Loader2 } from "lucide-react"
import { LoopCoinsBalance } from "@/components/shop/loop-coins-balance"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

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
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    fetchShopItems()
    if (user) {
      fetchUserInventory()
    }
  }, [user])

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
          switch (item.category) {
            case "theme":
              categorizedItems.themes.push(item)
              break
            case "animation":
              categorizedItems.animations.push(item)
              break
            case "effect":
              categorizedItems.effects.push(item)
              break
            case "coins":
              categorizedItems.coins.push(item)
              break
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
    if (!user?.token) return

    try {
      const response = await fetch("/api/inventory", {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })
      const data = await response.json()

      if (data.success) {
        const ownedItemIds = new Set(data.items.map((item: any) => item.item_id))
        setPurchasedItems(ownedItemIds)
      }
    } catch (error) {
      console.error("Error fetching inventory:", error)
    }
  }

  const handlePurchase = async (item: ShopItem) => {
    if (!user?.token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to make purchases.",
        variant: "destructive",
      })
      return
    }

    if (purchasedItems.has(item.id)) {
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
      const paymentMethod = item.category === "coins" ? "stripe" : "coins"
      const itemPrice = item.price || item.price_coins || 0

      if (paymentMethod === "coins" && (user?.loop_coins || 0) < itemPrice) {
        toast({
          title: "Insufficient Loop Coins",
          description: "You don't have enough Loop Coins for this purchase.",
          variant: "destructive",
        })
        setPurchasing(null)
        return
      }

      const response = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          item_id: item.id,
          payment_method: paymentMethod,
        }),
      })

      const data = await response.json()

      if (data.success) {
        if (paymentMethod === "coins") {
          setPurchasedItems((prev) => new Set([...prev, item.id]))
          toast({
            title: "Purchase Successful!",
            description: `You've purchased ${item.name} for ${itemPrice} Loop Coins.`,
          })
          // Refresh user data to update coin balance
          window.location.reload()
        } else {
          // Handle Stripe payment
          toast({
            title: "Redirecting to Payment",
            description: "You'll be redirected to complete your purchase.",
          })
          // TODO: Integrate Stripe Elements here
        }
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
        {/* Preview */}
        <div
          className="h-20 rounded-lg flex items-center justify-center text-4xl border"
          style={{
            background: item.preview_data?.preview?.startsWith("linear-gradient")
              ? item.preview_data.preview
              : "#f3f4f6",
          }}
        >
          {item.preview_data?.preview && !item.preview_data.preview.startsWith("linear-gradient")
            ? item.preview_data.preview
            : "🎨"}
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
            onClick={() => handlePurchase(item)}
            disabled={purchasedItems.has(item.id) || purchasing === item.id}
            className={
              purchasedItems.has(item.id)
                ? "bg-green-500 hover:bg-green-600"
                : item.category === "coins"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gradient-to-r from-purple-500 to-blue-500"
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
      {/* Coins Balance */}
      <div className="flex justify-center">
        <LoopCoinsBalance showDetails={true} />
      </div>

      {/* Shop Items */}
      <Tabs defaultValue="themes" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="themes" className="flex items-center space-x-2">
            <Palette className="w-4 h-4" />
            <span>Themes</span>
          </TabsTrigger>
          <TabsTrigger value="animations" className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4" />
            <span>Animations</span>
          </TabsTrigger>
          <TabsTrigger value="effects" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Effects</span>
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
