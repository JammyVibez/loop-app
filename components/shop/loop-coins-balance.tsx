"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Coins, Plus, Star } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface LoopCoinsBalanceProps {
  showDetails?: boolean
}

const coinPackages = [
  { id: "starter", coins: 1000, price: 4.99, bonus: 0, popular: false },
  { id: "popular", coins: 2500, price: 9.99, bonus: 500, popular: true },
  { id: "premium", coins: 5000, price: 19.99, bonus: 1500, popular: false },
  { id: "ultimate", coins: 10000, price: 34.99, bonus: 4000, popular: false },
]

export function LoopCoinsBalance({ showDetails = false }: LoopCoinsBalanceProps) {
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const handlePurchase = (pkg: (typeof coinPackages)[0]) => {
    // Simulate purchase
    toast({
      title: "Purchase Successful!",
      description: `You've purchased ${pkg.coins + pkg.bonus} Loop Coins for $${pkg.price}`,
    })
    setShowPurchaseDialog(false)
  }

  const formatCoins = (coins: number) => {
    if (coins >= 1000) {
      return (coins / 1000).toFixed(1) + "K"
    }
    return coins.toString()
  }

  if (!showDetails) {
    return (
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-semibold">{formatCoins(user?.loop_coins || 0)}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span>Purchase Loop Coins</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {coinPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`cursor-pointer transition-all hover:shadow-md ${pkg.popular ? "ring-2 ring-purple-500" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        <Coins className="w-5 h-5 text-yellow-500" />
                        <span className="font-bold">{pkg.coins.toLocaleString()}</span>
                        {pkg.bonus > 0 && (
                          <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                            +{pkg.bonus} bonus
                          </Badge>
                        )}
                      </div>
                      {pkg.popular && (
                        <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                          <Star className="w-3 h-3 mr-1" />
                          Popular
                        </Badge>
                      )}
                    </div>
                    <Button
                      onClick={() => handlePurchase(pkg)}
                      className="bg-gradient-to-r from-purple-500 to-blue-500"
                    >
                      ${pkg.price}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Coins className="w-5 h-5 text-yellow-500" />
          <span>Loop Coins Balance</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-purple-600">{(user?.loop_coins || 0).toLocaleString()}</div>
          <p className="text-sm text-gray-600">Loop Coins</p>
        </div>

        <Button
          onClick={() => setShowPurchaseDialog(true)}
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Purchase More Coins
        </Button>

        <div className="text-center">
          <p className="text-xs text-gray-500">Earn coins by creating popular loops and engaging with the community!</p>
        </div>
      </CardContent>
    </Card>
  )
}
