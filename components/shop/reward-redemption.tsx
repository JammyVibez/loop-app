"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Gift, Sparkles, Crown, Zap, Check } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface RewardItem {
  id: string
  name: string
  description: string
  category: string
  rarity: string
  preview_data?: any
  quest_reward: boolean
}

interface RewardRedemptionProps {
  availableRewards: RewardItem[]
  onRedemption: (itemId: string) => void
}

const rarityColors = {
  common: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  rare: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  epic: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  legendary: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
}

const categoryIcons = {
  theme: Sparkles,
  animation: Zap,
  effect: Crown,
}

export function RewardRedemption({ availableRewards, onRedemption }: RewardRedemptionProps) {
  const [redeeming, setRedeeming] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const handleRedeem = async (reward: RewardItem) => {
    if (!user?.token) return

    setRedeeming(reward.id)

    try {
      const response = await fetch("/api/shop/redeem-reward", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          reward_id: reward.id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        onRedemption(reward.id)
        toast({
          title: "Reward Redeemed!",
          description: `${reward.name} has been added to your inventory.`,
        })
      } else {
        toast({
          title: "Redemption Failed",
          description: data.error || "Failed to redeem reward",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while redeeming the reward",
        variant: "destructive",
      })
    } finally {
      setRedeeming(null)
    }
  }

  if (availableRewards.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Gift className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Rewards Available</h3>
          <p className="text-gray-600 dark:text-gray-400">Complete quests to unlock exclusive rewards!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Gift className="w-6 h-6 text-purple-600" />
        <h2 className="text-xl font-bold">Available Rewards</h2>
        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
          {availableRewards.length} items
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableRewards.map((reward) => {
          const IconComponent = categoryIcons[reward.category as keyof typeof categoryIcons] || Gift

          return (
            <Card
              key={reward.id}
              className="hover:shadow-lg transition-shadow border-2 border-purple-200 dark:border-purple-800"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <IconComponent className="w-5 h-5 text-purple-600" />
                    <span>{reward.name}</span>
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge className={rarityColors[reward.rarity as keyof typeof rarityColors]}>{reward.rarity}</Badge>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      <Gift className="w-3 h-3 mr-1" />
                      FREE
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview */}
                <div
                  className="h-20 rounded-lg flex items-center justify-center text-4xl border-2 border-dashed border-purple-300"
                  style={{
                    background: reward.preview_data?.preview?.startsWith("linear-gradient")
                      ? reward.preview_data.preview
                      : "#f3f4f6",
                  }}
                >
                  {reward.preview_data?.preview && !reward.preview_data.preview.startsWith("linear-gradient")
                    ? reward.preview_data.preview
                    : "🎁"}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">{reward.description}</p>

                <Button
                  onClick={() => handleRedeem(reward)}
                  disabled={redeeming === reward.id}
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                  {redeeming === reward.id ? (
                    "Redeeming..."
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Redeem Reward
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
