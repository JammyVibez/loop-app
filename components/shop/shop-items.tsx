"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Palette, Sparkles, Zap, Crown, Music, TreePine, User, Coins } from "lucide-react"
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
      category: "profile",
      rarity: "rare",
      premium_only: false,
    },
    {
      id: "sunset-dream",
      name: "Sunset Dream",
      description: "Warm sunset colors for a dreamy profile",
      price: 300,
      preview: "linear-gradient(45deg, #ff6b6b, #ffa500)",
      category: "profile",
      rarity: "common",
      premium_only: false,
    },
    {
      id: "galaxy-explorer",
      name: "Galaxy Explorer",
      description: "Deep space colors with stellar effects",
      price: 800,
      preview: "linear-gradient(45deg, #667eea, #764ba2)",
      category: "profile",
      rarity: "legendary",
      premium_only: true,
    },
    {
      id: "discord-dark",
      name: "Discord Dark",
      description: "Classic Discord dark theme colors",
      price: 400,
      preview: "linear-gradient(45deg, #36393f, #2f3136)",
      category: "profile",
      rarity: "rare",
      premium_only: false,
    },
    {
      id: "tree-golden",
      name: "Golden Tree Theme",
      description: "Makes your loop trees shine with golden branches",
      price: 1000,
      preview: "linear-gradient(45deg, #ffd700, #ffed4e)",
      category: "tree",
      rarity: "epic",
      premium_only: false,
    },
    {
      id: "avatar-sparkle",
      name: "Sparkle Avatar Frame",
      description: "Animated sparkle frame for your profile picture",
      price: 600,
      preview: "✨",
      category: "avatar",
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
      category: "avatar",
      rarity: "epic",
      premium_only: false,
    },
    {
      id: "sparkle-trail",
      name: "Sparkle Trail",
      description: "Magical sparkles that follow your avatar",
      price: 600,
      preview: "✨",
      category: "avatar",
      rarity: "rare",
      premium_only: false,
    },
    {
      id: "floating-glow",
      name: "Floating Glow",
      description: "Gentle floating motion with soft glow",
      price: 400,
      preview: "🎈",
      category: "profile",
      rarity: "common",
      premium_only: false,
    },
    {
      id: "premium-aura",
      name: "Premium Aura",
      description: "Exclusive golden aura effect",
      price: 1200,
      preview: "👑",
      category: "profile",
      rarity: "legendary",
      premium_only: true,
    },
  ],
  sounds: [
    {
      id: "welcome-chime",
      name: "Welcome Chime",
      description: "Plays when users visit your profile",
      price: 300,
      preview: "🎵",
      category: "profile",
      rarity: "rare",
      premium_only: false,
    },
    {
      id: "notification-bell",
      name: "Crystal Bell",
      description: "Custom notification sound",
      price: 200,
      preview: "🔔",
      category: "notification",
      rarity: "common",
      premium_only: false,
    },
    {
      id: "loop-success",
      name: "Success Chime",
      description: "Plays when your loops get liked",
      price: 250,
      preview: "🎶",
      category: "notification",
      rarity: "common",
      premium_only: false,
    },
  ],
  effects: [
    {
      id: "tree-skin-golden",
      name: "Golden Tree Skin",
      description: "Make your loop trees shine with golden branches",
      price: 1000,
      preview: "🌳✨",
      category: "tree",
      rarity: "legendary",
      premium_only: false,
    },
    {
      id: "branch-particles",
      name: "Branch Particles",
      description: "Animated particles around your branches",
      price: 650,
      preview: "🌿💫",
      category: "tree",
      rarity: "epic",
      premium_only: false,
    },
    {
      id: "loop-glow",
      name: "Loop Glow",
      description: "Subtle glow effect for your loop posts",
      price: 350,
      preview: "💡",
      category: "post",
      rarity: "common",
      premium_only: false,
    },
    {
      id: "post-sparkle",
      name: "Post Sparkle",
      description: "Sparkle animation for your posts",
      price: 500,
      preview: "✨",
      category: "post",
      rarity: "rare",
      premium_only: false,
    },
  ],
}

const rarityColors = {
  common: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  rare: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  epic: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  legendary: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
}

const categoryIcons = {
  profile: User,
  avatar: Crown,
  tree: TreePine,
  post: Sparkles,
  notification: Music,
}

export function ShopItems() {
  const [purchasedItems, setPurchasedItems] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const { user, updateProfile } = useAuth()

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

    if ((user?.loop_coins || 0) < item.price) {
      toast({
        title: "Insufficient Loop Coins",
        description: "You don't have enough Loop Coins for this purchase.",
        variant: "destructive",
      })
      return
    }

    // Add to user's inventory
    setPurchasedItems((prev) => new Set([...prev, item.id]))

    // Update user's coin balance
    updateProfile({
      loop_coins: (user?.loop_coins || 0) - item.price,
    })

    toast({
      title: "Purchase Successful!",
      description: `You've purchased ${item.name} for ${item.price} Loop Coins. Check your inventory to apply it!`,
    })
  }

  const renderItemCard = (item: any) => {
    const IconComponent = categoryIcons[item.category as keyof typeof categoryIcons] || Palette

    return (
      <Card key={item.id} className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <IconComponent className="w-4 h-4" />
              <span>{item.name}</span>
            </CardTitle>
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
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="font-bold text-lg text-purple-600">{item.price}</span>
              <span className="text-sm text-gray-500">Loop Coins</span>
            </div>

            <Button
              onClick={() => handlePurchase(item)}
              disabled={purchasedItems.has(item.id)}
              className={
                purchasedItems.has(item.id)
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-gradient-to-r from-purple-500 to-blue-500"
              }
            >
              {purchasedItems.has(item.id) ? "Owned" : "Purchase"}
            </Button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Category: {item.category} • Apply in Inventory after purchase
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
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
        <TabsTrigger value="sounds" className="flex items-center space-x-2">
          <Music className="w-4 h-4" />
          <span>Sounds</span>
        </TabsTrigger>
        <TabsTrigger value="effects" className="flex items-center space-x-2">
          <Zap className="w-4 h-4" />
          <span>Effects</span>
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

      <TabsContent value="sounds" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shopItems.sounds.map(renderItemCard)}
        </div>
      </TabsContent>

      <TabsContent value="effects" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shopItems.effects.map(renderItemCard)}
        </div>
      </TabsContent>
    </Tabs>
  )
}
