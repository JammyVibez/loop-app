"use client"

import type React from "react"

import { useState, useEffect, useContext } from "react"
import { RealtimeContext } from "@/providers/realtime-provider"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Gift, Coins, Crown, Palette, Sparkles, Heart, Star, Zap, TreePine, MessageCircle, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useRealtime } from "@/hooks/use-realtime"

interface GiftModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipient: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
  }
  context?: {
    type: "post" | "reel" | "profile" | "comment" | "branch"
    id: string
    title?: string
  }
}

interface GiftItem {
  id: string
  name: string
  description: string
  type: "coins" | "premium" | "theme" | "animation" | "effect" | "badge"
  cost: number
  icon: React.ReactNode
  rarity: "common" | "rare" | "epic" | "legendary"
  preview?: string
  duration?: string
  effects?: {
    animation?: string
    sound?: string
    particles?: boolean
  }
}

const giftItems: GiftItem[] = [
  // Coins
  {
    id: "coins-100",
    name: "100 Loop Coins",
    description: "A small token of appreciation",
    type: "coins",
    cost: 100,
    icon: <Coins className="w-6 h-6 text-yellow-500" />,
    rarity: "common",
    effects: { animation: "coin-shower", sound: "coin-drop", particles: true },
  },
  {
    id: "coins-500",
    name: "500 Loop Coins",
    description: "A generous gift of coins",
    type: "coins",
    cost: 500,
    icon: <Coins className="w-6 h-6 text-yellow-500" />,
    rarity: "rare",
    effects: { animation: "coin-explosion", sound: "coin-cascade", particles: true },
  },
  {
    id: "coins-1000",
    name: "1000 Loop Coins",
    description: "A very generous gift!",
    type: "coins",
    cost: 1000,
    icon: <Coins className="w-6 h-6 text-yellow-500" />,
    rarity: "epic",
    effects: { animation: "golden-rain", sound: "treasure-chest", particles: true },
  },

  // Premium
  {
    id: "premium-1week",
    name: "1 Week Premium",
    description: "Gift premium features for a week",
    type: "premium",
    cost: 750,
    icon: <Crown className="w-6 h-6 text-purple-500" />,
    rarity: "rare",
    duration: "1 week",
    effects: { animation: "crown-glow", sound: "royal-fanfare", particles: true },
  },
  {
    id: "premium-1month",
    name: "1 Month Premium",
    description: "A month of premium access",
    type: "premium",
    cost: 2000,
    icon: <Crown className="w-6 h-6 text-purple-500" />,
    rarity: "epic",
    duration: "1 month",
    effects: { animation: "royal-ascension", sound: "premium-unlock", particles: true },
  },
  {
    id: "premium-3months",
    name: "3 Months Premium",
    description: "Extended premium experience",
    type: "premium",
    cost: 5000,
    icon: <Crown className="w-6 h-6 text-purple-500" />,
    rarity: "legendary",
    duration: "3 months",
    effects: { animation: "legendary-crown", sound: "epic-triumph", particles: true },
  },

  // Themes
  {
    id: "theme-neon",
    name: "Neon Cyber Theme",
    description: "Futuristic neon theme",
    type: "theme",
    cost: 800,
    icon: <Palette className="w-6 h-6 text-cyan-500" />,
    rarity: "epic",
    preview: "linear-gradient(45deg, #00ff88, #00ccff)",
    effects: { animation: "neon-pulse", sound: "cyber-activate", particles: true },
  },
  {
    id: "theme-sunset",
    name: "Sunset Dream Theme",
    description: "Warm sunset colors",
    type: "theme",
    cost: 600,
    icon: <Palette className="w-6 h-6 text-orange-500" />,
    rarity: "rare",
    preview: "linear-gradient(45deg, #ff6b6b, #ffa500)",
    effects: { animation: "sunset-glow", sound: "peaceful-chime", particles: true },
  },

  // Animations & Effects
  {
    id: "animation-sparkle",
    name: "Sparkle Trail",
    description: "Magical sparkles animation",
    type: "animation",
    cost: 1200,
    icon: <Sparkles className="w-6 h-6 text-pink-500" />,
    rarity: "epic",
    effects: { animation: "sparkle-trail", sound: "magic-sparkle", particles: true },
  },
  {
    id: "effect-glow",
    name: "Golden Glow",
    description: "Premium golden glow effect",
    type: "effect",
    cost: 1500,
    icon: <Zap className="w-6 h-6 text-yellow-500" />,
    rarity: "legendary",
    effects: { animation: "golden-aura", sound: "divine-glow", particles: true },
  },

  // Special Badges
  {
    id: "badge-supporter",
    name: "Supporter Badge",
    description: "Show you support this creator",
    type: "badge",
    cost: 300,
    icon: <Heart className="w-6 h-6 text-red-500" />,
    rarity: "common",
    effects: { animation: "heart-pulse", sound: "support-cheer", particles: true },
  },
  {
    id: "badge-superfan",
    name: "Super Fan Badge",
    description: "Ultimate fan recognition",
    type: "badge",
    cost: 1000,
    icon: <Star className="w-6 h-6 text-gold-500" />,
    rarity: "rare",
    effects: { animation: "star-burst", sound: "fan-celebration", particles: true },
  },
]

const rarityColors = {
  common: "bg-gray-100 text-gray-700 border-gray-200",
  rare: "bg-blue-100 text-blue-700 border-blue-200",
  epic: "bg-purple-100 text-purple-700 border-purple-200",
  legendary: "bg-yellow-100 text-yellow-700 border-yellow-200",
}

export function GiftModal({ open, onOpenChange, recipient, context }: GiftModalProps) {
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null)
  const [message, setMessage] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [userBalance, setUserBalance] = useState(0)
  const { toast } = useToast()
  const { user, refreshUser } = useAuth()
  const { socket, isConnected } = useRealtime()

  useEffect(() => {
    if (user?.loop_coins) {
      setUserBalance(user.loop_coins)
    }
  }, [user?.loop_coins])

  useEffect(() => {
    if (socket && isConnected) {
      socket.on("balance_updated", (data: { user_id: string; new_balance: number }) => {
        if (data.user_id === user?.id) {
          setUserBalance(data.new_balance)
        }
      })

      return () => {
        socket.off("balance_updated")
      }
    }
  }, [socket, isConnected, user?.id])

  const handleSendGift = async () => {
    if (!selectedGift || !user) return

    if (userBalance < selectedGift.cost) {
      toast({
        title: "Insufficient Coins",
        description: "You don't have enough Loop Coins for this gift.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch("/api/gifts/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          recipient_id: recipient.id,
          gift_item_id: selectedGift.id,
          message: message.trim(),
          is_anonymous: isAnonymous,
          context: context,
          effects: selectedGift.effects,
        }),
      })

      const data = await response.json()

      if (data.success) {
        if (socket && isConnected) {
          socket.emit("gift_sent", {
            sender_id: user.id,
            recipient_id: recipient.id,
            gift: selectedGift,
            message: message.trim(),
            is_anonymous: isAnonymous,
            context: context,
            timestamp: new Date().toISOString(),
          })
        }

        setUserBalance((prev) => prev - selectedGift.cost)

        toast({
          title: "Gift Sent! 🎁",
          description: `You've sent ${selectedGift.name} to ${recipient.display_name}!`,
          duration: 5000,
        })

        triggerGiftAnimation(selectedGift)

        onOpenChange(false)
        setSelectedGift(null)
        setMessage("")
        setIsAnonymous(false)

        // Refresh user data in background
        refreshUser()
      } else {
        throw new Error(data.error || "Failed to send gift")
      }
    } catch (error) {
      console.error("Gift sending error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send gift. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const triggerGiftAnimation = (gift: GiftItem) => {
    if (gift.effects?.animation) {
      // Trigger CSS animation or particle effect
      document.body.classList.add(`gift-animation-${gift.effects.animation}`)
      setTimeout(() => {
        document.body.classList.remove(`gift-animation-${gift.effects.animation}`)
      }, 3000)
    }

    if (gift.effects?.sound) {
      // Play gift sound effect
      const audio = new Audio(`/sounds/gifts/${gift.effects.sound}.mp3`)
      audio.volume = 0.3
      audio.play().catch(() => {
        // Ignore audio play errors (user interaction required)
      })
    }
  }

  const getContextIcon = () => {
    if (!context) return <Gift className="w-4 h-4" />

    switch (context.type) {
      case "post":
        return <MessageCircle className="w-4 h-4" />
      case "reel":
        return <Sparkles className="w-4 h-4" />
      case "branch":
        return <TreePine className="w-4 h-4" />
      default:
        return <Gift className="w-4 h-4" />
    }
  }

  const groupedGifts = giftItems.reduce(
    (acc, gift) => {
      if (!acc[gift.type]) acc[gift.type] = []
      acc[gift.type].push(gift)
      return acc
    },
    {} as Record<string, GiftItem[]>,
  )

  // Check if RealtimeContext is available
  const { socket: realtimeSocket, isConnected: realtimeIsConnected } = useContext(RealtimeContext) || { socket: null, isConnected: false }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Gift className="w-5 h-5 text-purple-500" />
            <span>Send a Gift</span>
            {realtimeIsConnected && (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                Live
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Info */}
          <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Avatar className="w-12 h-12">
              <AvatarImage src={recipient.avatar_url || "/placeholder.svg"} alt={recipient.display_name} />
              <AvatarFallback>{recipient.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold">{recipient.display_name}</p>
              <p className="text-sm text-gray-500">@{recipient.username}</p>
              {context && (
                <div className="flex items-center space-x-1 mt-1">
                  {getContextIcon()}
                  <span className="text-xs text-gray-400">
                    Gift for {context.type}: {context.title || context.id}
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Your Balance</p>
              <div className="flex items-center space-x-1">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className="font-bold text-lg">{userBalance.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Gift Selection */}
          <Tabs defaultValue="coins" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="coins">Coins</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
              <TabsTrigger value="theme">Themes</TabsTrigger>
              <TabsTrigger value="animation">Animations</TabsTrigger>
              <TabsTrigger value="effect">Effects</TabsTrigger>
              <TabsTrigger value="badge">Badges</TabsTrigger>
            </TabsList>

            {Object.entries(groupedGifts).map(([type, gifts]) => (
              <TabsContent key={type} value={type} className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gifts.map((gift) => (
                    <div
                      key={gift.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:scale-105 ${
                        selectedGift?.id === gift.id
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-lg"
                          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                      } ${userBalance < gift.cost ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => userBalance >= gift.cost && setSelectedGift(gift)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">{gift.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-sm">{gift.name}</h3>
                            <Badge className={`text-xs ${rarityColors[gift.rarity]}`}>{gift.rarity}</Badge>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{gift.description}</p>
                          {gift.preview && (
                            <div className="w-full h-6 rounded mb-2" style={{ background: gift.preview }} />
                          )}
                          {gift.duration && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Duration: {gift.duration}</p>
                          )}
                          {gift.effects && (
                            <div className="flex items-center space-x-1 mb-2">
                              <Sparkles className="w-3 h-3 text-purple-500" />
                              <span className="text-xs text-purple-600">Special Effects</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <Coins className="w-3 h-3 text-yellow-500" />
                              <span className="text-sm font-medium">{gift.cost.toLocaleString()}</span>
                            </div>
                            {userBalance < gift.cost && (
                              <span className="text-xs text-red-500">Insufficient coins</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Gift Message */}
          {selectedGift && (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div>
                <Label htmlFor="gift-message">Personal Message (Optional)</Label>
                <Textarea
                  id="gift-message"
                  placeholder="Add a personal message with your gift..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">{message.length}/500 characters</p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="anonymous"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="anonymous" className="text-sm">
                  Send anonymously
                </Label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    Selected: <span className="font-medium">{selectedGift.name}</span>
                  </p>
                  <p>
                    Cost: <span className="font-medium">{selectedGift.cost.toLocaleString()} Loop Coins</span>
                  </p>
                  <p>
                    Your Balance: <span className="font-medium">{userBalance.toLocaleString()} Loop Coins</span>
                  </p>
                  <p>
                    After Gift:{" "}
                    <span className="font-medium">{(userBalance - selectedGift.cost).toLocaleString()} Loop Coins</span>
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendGift}
                    disabled={isProcessing || userBalance < selectedGift.cost}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Gift className="w-4 h-4 mr-2" />
                        Send Gift
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}