"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Gift,
  Coins,
  Crown,
  Heart,
  Star,
  Zap,
  Sparkles,
  Dragon,
  TreePine,
  Flame,
  Snowflake,
  Music,
  Coffee,
  Cake,
  Flower,
  Diamond,
  Trophy,
  Rocket,
  Rainbow,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface GiftItem {
  id: string
  name: string
  description: string
  price: number
  category: 'premium' | 'animated' | 'themed' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  animation_url?: string
  static_url: string
  theme_data?: {
    theme_name: string
    colors: string[]
    effects: string[]
  }
  is_limited?: boolean
  available_until?: string
  icon: React.ReactNode
}

interface GiftModalProps {
  isOpen: boolean
  onClose: () => void
  recipient: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_premium: boolean
  }
  context?: 'profile' | 'post' | 'message'
  contextId?: string
}

const GIFT_CATEGORIES = {
  premium: [
    {
      id: 'premium_month',
      name: 'Premium Month',
      description: 'Gift 1 month of Loop Premium',
      price: 500,
      category: 'premium' as const,
      rarity: 'epic' as const,
      static_url: '/gifts/premium-month.png',
      icon: <Crown className="w-6 h-6 text-yellow-500" />,
    },
    {
      id: 'premium_year',
      name: 'Premium Year',
      description: 'Gift 1 year of Loop Premium',
      price: 5000,
      category: 'premium' as const,
      rarity: 'legendary' as const,
      static_url: '/gifts/premium-year.png',
      icon: <Crown className="w-6 h-6 text-purple-500" />,
    },
  ],
  animated: [
    {
      id: 'floating_dragon',
      name: 'Floating Dragon',
      description: 'Animated dragon that floats around profile',
      price: 200,
      category: 'animated' as const,
      rarity: 'rare' as const,
      animation_url: '/gifts/animations/floating-dragon.gif',
      static_url: '/gifts/dragon-static.png',
      icon: <Dragon className="w-6 h-6 text-red-500" />,
    },
    {
      id: 'sparkle_trail',
      name: 'Sparkle Trail',
      description: 'Magical sparkles follow your cursor',
      price: 150,
      category: 'animated' as const,
      rarity: 'rare' as const,
      animation_url: '/gifts/animations/sparkle-trail.gif',
      static_url: '/gifts/sparkles-static.png',
      icon: <Sparkles className="w-6 h-6 text-purple-400" />,
    },
    {
      id: 'flame_aura',
      name: 'Flame Aura',
      description: 'Fiery aura around your avatar',
      price: 300,
      category: 'animated' as const,
      rarity: 'epic' as const,
      animation_url: '/gifts/animations/flame-aura.gif',
      static_url: '/gifts/flame-static.png',
      icon: <Flame className="w-6 h-6 text-orange-500" />,
    },
  ],
  themed: [
    {
      id: 'dragon_lord_theme',
      name: 'Dragon Lord Theme',
      description: 'Complete dragon-themed profile makeover',
      price: 800,
      category: 'themed' as const,
      rarity: 'legendary' as const,
      static_url: '/gifts/themes/dragon-lord.png',
      theme_data: {
        theme_name: 'Dragon Lord',
        colors: ['#8B0000', '#FFD700', '#FF4500'],
        effects: ['dragon_particles', 'flame_border', 'roar_sound'],
      },
      icon: <Dragon className="w-6 h-6 text-red-600" />,
    },
    {
      id: 'forest_guardian',
      name: 'Forest Guardian',
      description: 'Nature-themed profile with tree animations',
      price: 600,
      category: 'themed' as const,
      rarity: 'epic' as const,
      static_url: '/gifts/themes/forest-guardian.png',
      theme_data: {
        theme_name: 'Forest Guardian',
        colors: ['#228B22', '#8FBC8F', '#32CD32'],
        effects: ['leaf_particles', 'tree_growth', 'bird_sounds'],
      },
      icon: <TreePine className="w-6 h-6 text-green-600" />,
    },
    {
      id: 'ice_crystal',
      name: 'Ice Crystal',
      description: 'Frozen theme with crystal effects',
      price: 500,
      category: 'themed' as const,
      rarity: 'rare' as const,
      static_url: '/gifts/themes/ice-crystal.png',
      theme_data: {
        theme_name: 'Ice Crystal',
        colors: ['#87CEEB', '#B0E0E6', '#E0FFFF'],
        effects: ['snow_particles', 'ice_border', 'wind_sound'],
      },
      icon: <Snowflake className="w-6 h-6 text-blue-400" />,
    },
  ],
  special: [
    {
      id: 'loop_coins_100',
      name: '100 Loop Coins',
      description: 'Gift 100 Loop Coins',
      price: 50,
      category: 'special' as const,
      rarity: 'common' as const,
      static_url: '/gifts/coins-100.png',
      icon: <Coins className="w-6 h-6 text-yellow-500" />,
    },
    {
      id: 'loop_coins_500',
      name: '500 Loop Coins',
      description: 'Gift 500 Loop Coins',
      price: 200,
      category: 'special' as const,
      rarity: 'rare' as const,
      static_url: '/gifts/coins-500.png',
      icon: <Coins className="w-6 h-6 text-yellow-600" />,
    },
    {
      id: 'birthday_cake',
      name: 'Birthday Cake',
      description: 'Special birthday celebration gift',
      price: 100,
      category: 'special' as const,
      rarity: 'common' as const,
      static_url: '/gifts/birthday-cake.png',
      icon: <Cake className="w-6 h-6 text-pink-500" />,
    },
    {
      id: 'diamond_ring',
      name: 'Diamond Ring',
      description: 'Luxury diamond ring gift',
      price: 1000,
      category: 'special' as const,
      rarity: 'legendary' as const,
      static_url: '/gifts/diamond-ring.png',
      icon: <Diamond className="w-6 h-6 text-blue-300" />,
    },
  ],
}

const rarityColors = {
  common: 'bg-gray-100 text-gray-700 border-gray-300',
  rare: 'bg-blue-100 text-blue-700 border-blue-300',
  epic: 'bg-purple-100 text-purple-700 border-purple-300',
  legendary: 'bg-yellow-100 text-yellow-700 border-yellow-300',
}

export function EnhancedGiftModal({ isOpen, onClose, recipient, context, contextId }: GiftModalProps) {
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null)
  const [giftMessage, setGiftMessage] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isGifting, setIsGifting] = useState(false)
  const [userCoins, setUserCoins] = useState(0)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchUserCoins()
    }
  }, [user])

  const fetchUserCoins = async () => {
    try {
      const response = await fetch('/api/users/coins', {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        setUserCoins(data.coins)
      }
    } catch (error) {
      console.error('Error fetching user coins:', error)
    }
  }

  const handleGiftSend = async () => {
    if (!selectedGift || !user) return

    if (userCoins < selectedGift.price) {
      toast({
        title: "Insufficient Coins",
        description: "You don't have enough Loop Coins for this gift.",
        variant: "destructive",
      })
      return
    }

    setIsGifting(true)

    try {
      const response = await fetch('/api/gifts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          recipient_id: recipient.id,
          gift_id: selectedGift.id,
          message: giftMessage,
          is_anonymous: isAnonymous,
          context,
          context_id: contextId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Gift Sent! 🎁",
          description: `You sent ${selectedGift.name} to ${recipient.display_name}`,
        })
        
        // Update user coins
        setUserCoins(prev => prev - selectedGift.price)
        
        // Reset form
        setSelectedGift(null)
        setGiftMessage("")
        setIsAnonymous(false)
        onClose()
      } else {
        toast({
          title: "Gift Failed",
          description: data.error || "Failed to send gift",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error sending gift:', error)
      toast({
        title: "Gift Failed",
        description: "An error occurred while sending the gift",
        variant: "destructive",
      })
    } finally {
      setIsGifting(false)
    }
  }

  const renderGiftCard = (gift: GiftItem) => (
    <Card
      key={gift.id}
      className={`cursor-pointer transition-all hover:shadow-lg ${
        selectedGift?.id === gift.id ? 'ring-2 ring-purple-500' : ''
      }`}
      onClick={() => setSelectedGift(gift)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {gift.icon}
            <Badge className={rarityColors[gift.rarity]}>
              {gift.rarity}
            </Badge>
          </div>
          <div className="flex items-center space-x-1">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-bold text-purple-600">{gift.price}</span>
          </div>
        </div>

        <div className="text-center mb-3">
          <div className="w-16 h-16 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center">
            {gift.animation_url ? (
              <img
                src={gift.animation_url}
                alt={gift.name}
                className="w-12 h-12 object-contain"
              />
            ) : (
              <img
                src={gift.static_url}
                alt={gift.name}
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  // Fallback to icon if image fails to load
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
            )}
            <div className="hidden text-4xl">{gift.icon}</div>
          </div>
          <h3 className="font-semibold text-sm">{gift.name}</h3>
          <p className="text-xs text-gray-500 mt-1">{gift.description}</p>
        </div>

        {gift.theme_data && (
          <div className="text-xs text-center">
            <Badge variant="outline" className="text-xs">
              Theme: {gift.theme_data.theme_name}
            </Badge>
          </div>
        )}

        {gift.is_limited && (
          <Badge variant="destructive" className="w-full justify-center mt-2 text-xs">
            Limited Time
          </Badge>
        )}
      </CardContent>
    </Card>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Gift className="w-5 h-5 text-purple-500" />
            <span>Send Gift to {recipient.display_name}</span>
          </DialogTitle>
          <DialogDescription>
            Choose a special gift to send to @{recipient.username}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Info */}
          <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Avatar className="h-12 w-12">
              <AvatarImage src={recipient.avatar_url} />
              <AvatarFallback>{recipient.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{recipient.display_name}</h3>
              <p className="text-sm text-gray-500">@{recipient.username}</p>
              {recipient.is_premium && (
                <Badge className="mt-1">
                  <Crown className="w-3 h-3 mr-1" />
                  Premium
                </Badge>
              )}
            </div>
          </div>

          {/* User Coins Balance */}
          <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="font-semibold">Your Loop Coins</span>
            </div>
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              {userCoins.toLocaleString()}
            </Badge>
          </div>

          {/* Gift Categories */}
          <Tabs defaultValue="special" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="special">Special</TabsTrigger>
              <TabsTrigger value="animated">Animated</TabsTrigger>
              <TabsTrigger value="themed">Themed</TabsTrigger>
              <TabsTrigger value="premium">Premium</TabsTrigger>
            </TabsList>

            <TabsContent value="special" className="mt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {GIFT_CATEGORIES.special.map(renderGiftCard)}
              </div>
            </TabsContent>

            <TabsContent value="animated" className="mt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {GIFT_CATEGORIES.animated.map(renderGiftCard)}
              </div>
            </TabsContent>

            <TabsContent value="themed" className="mt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {GIFT_CATEGORIES.themed.map(renderGiftCard)}
              </div>
            </TabsContent>

            <TabsContent value="premium" className="mt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {GIFT_CATEGORIES.premium.map(renderGiftCard)}
              </div>
            </TabsContent>
          </Tabs>

          {/* Selected Gift Details */}
          {selectedGift && (
            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-900/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  {selectedGift.icon}
                  <span>{selectedGift.name}</span>
                  <Badge className={rarityColors[selectedGift.rarity]}>
                    {selectedGift.rarity}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {selectedGift.description}
                </p>

                <div className="flex items-center justify-between">
                  <span className="font-semibold">Price:</span>
                  <div className="flex items-center space-x-1">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <span className="font-bold text-purple-600">{selectedGift.price}</span>
                  </div>
                </div>

                {selectedGift.theme_data && (
                  <div>
                    <span className="font-semibold">Theme Effects:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedGift.theme_data.effects.map((effect) => (
                        <Badge key={effect} variant="outline" className="text-xs">
                          {effect.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Gift Message (Optional)</label>
                    <Textarea
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      placeholder="Add a personal message with your gift..."
                      className="mt-1"
                      maxLength={200}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {giftMessage.length}/200 characters
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="anonymous"
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="anonymous" className="text-sm">
                      Send anonymously
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleGiftSend}
            disabled={!selectedGift || isGifting || userCoins < (selectedGift?.price || 0)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            {isGifting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Gift className="w-4 h-4 mr-2" />
                Send Gift
                {selectedGift && (
                  <span className="ml-2">
                    ({selectedGift.price} <Coins className="w-3 h-3 inline" />)
                  </span>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
