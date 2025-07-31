"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Coins, Palette, Sparkles, Zap, Crown, Star } from "lucide-react"
import { LoopCoinsBalance } from "@/components/shop/loop-coins-balance"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

const shopItems = {
  themes: [
    {
      id: "neon-cyber",
      name: "Neon Cyber",
      description: "Futuristic neon colors with cyberpunk vibes",
      price: 500,
      preview: "linear-gradient(45deg, #00ff88, #00ccff)",
      category: "theme",
      rarity: "rare",
      premium_only: false,
    },
    {
      id: "sunset-dream",
      name: "Sunset Dream",
      description: "Warm sunset colors for a dreamy profile",
      price: 300,
      preview: "linear-gradient(45deg, #ff6b6b, #ffa500)",
      category: "theme",
      rarity: "common",
      premium_only: false,
    },
    {
      id: "galaxy-explorer",
      name: "Galaxy Explorer",
      description: "Deep space colors with stellar effects",
      price: 800,
      preview: "linear-gradient(45deg, #667eea, #764ba2)",
      category: "theme",
      rarity: "legendary",
      premium_only: true,
    },
    {
      id: "discord-dark",
      name: "Discord Dark",
      description: "Classic Discord dark theme colors",
      price: 400,
      preview: "linear-gradient(45deg, #36393f, #2f3136)",
      category: "theme",
      rarity: "rare",
      premium_only: false,
    },
  ],
  animations: [
    {
      id: "rainbow-pulse",
      name: "Rainbow Pulse",
      description: "Animated rainbow effect for your avatar",
      price: 750,
      preview: "🌈",
      category: "animation",
      rarity: "epic",
      premium_only: false,
    },
    {
      id: "sparkle-trail",
      name: "Sparkle Trail",
      description: "Magical sparkles that follow your avatar",
      price: 600,
      preview: "✨",
      category: "animation",
      rarity: "rare",
      premium_only: false,
    },
    {
      id: "floating-glow",
      name: "Floating Glow",
      description: "Gentle floating motion with soft glow",
      price: 400,
      preview: "🎈",
      category: "animation",
      rarity: "common",
      premium_only: false,
    },
    {
      id: "premium-aura",
      name: "Premium Aura",
      description: "Exclusive golden aura effect",
      price: 1200,
      preview: "👑",
      category: "animation",
      rarity: "legendary",
      premium_only: true,
    },
  ],
  effects: [
    {
      id: "tree-skin-golden",
      name: "Golden Tree Skin",
      description: "Make your loop trees shine with golden branches",
      price: 1000,
      preview: "🌳✨",
      category: "effect",
      rarity: "legendary",
      premium_only: false,
    },
    {
      id: "branch-particles",
      name: "Branch Particles",
      description: "Animated particles around your branches",
      price: 650,
      preview: "🌿💫",
      category: "effect",
      rarity: "epic",
      premium_only: false,
    },
    {
      id: "loop-glow",
      name: "Loop Glow",
      description: "Subtle glow effect for your loop posts",
      price: 350,
      preview: "💡",
      category: "effect",
      rarity: "common",
      premium_only: false,
    },
  ],
  coins: [
    {
      id: "coins-1000",
      name: "1,000 Loop Coins",
      description: "Perfect for getting started with customizations",
      price: 4.99,
      preview: "💰",
      category: "coins",
      rarity: "common",
      premium_only: false,
      coins_amount: 1000,
    },
    {
      id: "coins-2500",
      name: "2,500 Loop Coins",
      description: "Great value pack with bonus coins",
      price: 9.99,
      preview: "💎",
      category: "coins",
      rarity: "rare",
      premium_only: false,
      coins_amount: 2500,
      bonus: 500,
    },
    {
      id: "coins-5000",
      name: "5,000 Loop Coins",
      description: "Premium pack for serious customizers",
      price: 19.99,
      preview: "👑",
      category: "coins",
      rarity: "epic",
      premium_only: false,
      coins_amount: 5000,
      bonus: 1500,
    },
  ],
}

const rarityColors = {
  common: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  rare: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  epic: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  legendary: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
}

export function ShopContent() {
  const [purchasedItems, setPurchasedItems] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const { user } = useAuth()

  const handlePurchase = (item: any) => {
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

    if (item.category === "coins") {
      // Handle Stripe payment for coins
      toast({
        title: "Redirecting to Payment",
        description: "You'll be redirected to complete your purchase.",
      })
      // TODO: Integrate Stripe payment
      return
    }

    if ((user?.loop_coins || 0) < item.price) {
      toast({
        title: "Insufficient Loop Coins",
        description: "You don't have enough Loop Coins for this purchase.",
        variant: "destructive",
      })
      return
    }

    // Simulate purchase
    setPurchasedItems((prev) => new Set([...prev, item.id]))
    toast({
      title: "Purchase Successful!",
      description: `You've purchased ${item.name} for ${item.price} Loop Coins.`,
    })
  }

  const renderItemCard = (item: any) => (
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
            background: item.preview.startsWith("linear-gradient") ? item.preview : "#f3f4f6",
          }}
        >
          {!item.preview.startsWith("linear-gradient") && item.preview}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {item.category === "coins" ? (
              <>
                <span className="font-bold text-lg text-green-600">${item.price}</span>
                <span className="text-sm text-gray-500">USD</span>
              </>
            ) : (
              <>
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="font-bold text-lg text-purple-600">{item.price}</span>
                <span className="text-sm text-gray-500">Loop Coins</span>
              </>
            )}
          </div>

          <Button
            onClick={() => handlePurchase(item)}
            disabled={purchasedItems.has(item.id)}
            className={
              purchasedItems.has(item.id)
                ? "bg-green-500 hover:bg-green-600"
                : item.category === "coins"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gradient-to-r from-purple-500 to-blue-500"
            }
          >
            {purchasedItems.has(item.id) ? "Owned" : item.category === "coins" ? "Buy Now" : "Purchase"}
          </Button>
        </div>

        {item.bonus && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
            <span className="text-sm text-green-700 dark:text-green-300 font-medium">
              +{item.bonus} bonus coins included!
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )

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
