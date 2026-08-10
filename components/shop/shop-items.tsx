"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Sparkles, Zap, Crown, Music, TreePine, User, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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
      id: "cyberpunk-matrix",
      name: "Cyberpunk Matrix",
      description: "Neon terminal green rain gradient for matrix aesthetics",
      price: 600,
      preview: "linear-gradient(45deg, #10b981, #064e3b)",
      category: "profile",
      rarity: "rare",
      premium_only: false,
    },
    {
      id: "obsidian-velvet",
      name: "Obsidian Velvet",
      description: "Sleek, deep dark luxury theme with metallic silver accents",
      price: 450,
      preview: "linear-gradient(45deg, #0f172a, #334155)",
      category: "profile",
      rarity: "common",
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
      id: "emerald-aurora",
      name: "Emerald Aurora",
      description: "Deep northern lights gradient with shimmering emerald green",
      price: 700,
      preview: "linear-gradient(45deg, #059669, #0d9488)",
      category: "profile",
      rarity: "epic",
      premium_only: false,
    },
    {
      id: "midnight-vapor",
      name: "Midnight Vapor",
      description: "Synthwave neon magenta and cyan twilight theme",
      price: 650,
      preview: "linear-gradient(45deg, #ec4899, #06b6d4)",
      category: "profile",
      rarity: "rare",
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
      id: "tree-golden",
      name: "Golden Tree Theme",
      description: "Makes your loop trees shine with golden branches",
      price: 1000,
      preview: "linear-gradient(45deg, #ffd700, #ffed4e)",
      category: "tree",
      rarity: "epic",
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
      id: "neon-pulse-ring",
      name: "Neon Pulse Ring",
      description: "Electric cyan glowing ring surrounding your profile picture",
      price: 500,
      preview: "⭕",
      category: "avatar",
      rarity: "rare",
      premium_only: false,
    },
    {
      id: "diamond-crown",
      name: "Diamond Crown Frame",
      description: "Shimmering diamond tiara frame for elite profiles",
      price: 1200,
      preview: "💎",
      category: "avatar",
      rarity: "legendary",
      premium_only: false,
    },
    {
      id: "fire-flame-ring",
      name: "Blazing Flame Avatar Ring",
      description: "Dynamic fiery border ring for hot takes",
      price: 800,
      preview: "🔥",
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
      id: "supernova-loop-glow",
      name: "Supernova Loop Flare",
      description: "Explosive cosmic glow effect on all your created loops",
      price: 850,
      preview: "💥",
      category: "post",
      rarity: "legendary",
      premium_only: false,
    },
    {
      id: "hologram-ripple",
      name: "Holographic Shimmer",
      description: "Futuristic 3D holographic card sheen for loop posts",
      price: 750,
      preview: "🔮",
      category: "post",
      rarity: "epic",
      premium_only: false,
    },
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
  common: "bg-slate-800 text-slate-300 border border-slate-700",
  rare: "bg-blue-950/80 text-blue-300 border border-blue-500/40",
  epic: "bg-purple-950/80 text-purple-300 border border-purple-500/40",
  legendary: "bg-amber-950/80 text-amber-300 border border-amber-500/40",
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
      <Card key={item.id} className="bg-slate-900/80 border-slate-800 text-slate-100 rounded-2xl shadow-lg hover:border-slate-700 transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold flex items-center space-x-2 text-slate-100">
              <IconComponent className="w-4 h-4 text-cyan-400" />
              <span>{item.name}</span>
            </CardTitle>
            <div className="flex items-center space-x-1.5">
              <Badge className={`${rarityColors[item.rarity as keyof typeof rarityColors]} text-[10px] uppercase font-bold px-2 py-0.5 rounded-full`}>
                {item.rarity}
              </Badge>
              {item.premium_only && (
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  <Crown className="w-3 h-3 mr-1" />
                  Pro
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview */}
          <div
            className="h-24 rounded-xl flex items-center justify-center text-3xl border border-white/5 relative overflow-hidden shadow-inner"
            style={{
              background: item.preview.startsWith("linear-gradient") ? item.preview : "rgba(15, 23, 42, 0.8)",
            }}
          >
            {!item.preview.startsWith("linear-gradient") && (
              <span className="p-3 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/10">{item.preview}</span>
            )}
          </div>

          <p className="text-xs text-slate-400 min-h-[36px]">{item.description}</p>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-1.5">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="font-extrabold text-base text-amber-300">{item.price}</span>
              <span className="text-xs text-slate-500 font-medium">Coins</span>
            </div>

            <Button
              onClick={() => handlePurchase(item)}
              disabled={purchasedItems.has(item.id)}
              className={
                purchasedItems.has(item.id)
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 font-bold rounded-xl text-xs"
                  : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-md"
              }
            >
              {purchasedItems.has(item.id) ? "Owned" : "Purchase"}
            </Button>
          </div>

          <div className="text-[10px] text-slate-500">
            Category: {item.category} • Apply in Inventory after purchase
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="themes" className="w-full">
      <TabsList className="grid w-full grid-cols-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5">
        <TabsTrigger value="themes" className="flex items-center space-x-2 rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">
          <Palette className="w-4 h-4" />
          <span>Themes</span>
        </TabsTrigger>
        <TabsTrigger value="animations" className="flex items-center space-x-2 rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">
          <Sparkles className="w-4 h-4" />
          <span>Frames & Anims</span>
        </TabsTrigger>
        <TabsTrigger value="sounds" className="flex items-center space-x-2 rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">
          <Music className="w-4 h-4" />
          <span>Sounds</span>
        </TabsTrigger>
        <TabsTrigger value="effects" className="flex items-center space-x-2 rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">
          <Zap className="w-4 h-4" />
          <span>Loop Effects</span>
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
