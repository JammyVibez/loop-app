"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Coins, Plus, Star, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface LoopCoinsBalanceProps {
  showDetails?: boolean
}

interface CoinPackage {
  id: string
  name: string
  description: string
  price_usd: number
  item_data: {
    coins_amount: number
    bonus: number
  }
  rarity: string
}

export function LoopCoinsBalance({ showDetails = false }: LoopCoinsBalanceProps) {
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false)
  const [coinPackages, setCoinPackages] = useState<CoinPackage[]>([])
  const [loading, setLoading] = useState(false)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (showPurchaseDialog) {
      fetchCoinPackages()
    }
  }, [showPurchaseDialog])

  const fetchCoinPackages = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/shop/items?category=coins")
      const data = await response.json()

      if (data.success) {
        setCoinPackages(data.items)
      }
    } catch (error) {
      console.error("Error fetching coin packages:", error)
      toast({
        title: "Error",
        description: "Failed to load coin packages",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (pkg: CoinPackage) => {
    if (!user?.token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to purchase coins.",
        variant: "destructive",
      })
      return
    }

    setPurchasing(pkg.id)

    try {
      const response = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          item_id: pkg.id,
          payment_method: "stripe",
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Redirecting to Payment",
          description: "You'll be redirected to complete your purchase.",
        })
        // TODO: Integrate Stripe Elements here
        setShowPurchaseDialog(false)
      } else {
        toast({
          title: "Purchase Failed",
          description: data.error || "Failed to initiate purchase",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error purchasing coins:", error)
      toast({
        title: "Purchase Failed",
        description: "An error occurred while processing your purchase",
        variant: "destructive",
      })
    } finally {
      setPurchasing(null)
    }
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
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading coin packages...</span>
              </div>
            ) : (
              coinPackages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${pkg.rarity === "rare" ? "ring-2 ring-purple-500" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-1">
                          <Coins className="w-5 h-5 text-yellow-500" />
                          <span className="font-bold">{pkg.item_data.coins_amount.toLocaleString()}</span>
                          {pkg.item_data.bonus > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                              +{pkg.item_data.bonus} bonus
                            </Badge>
                          )}
                        </div>
                        {pkg.rarity === "rare" && (
                          <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                            <Star className="w-3 h-3 mr-1" />
                            Popular
                          </Badge>
                        )}
                      </div>
                      <Button
                        onClick={() => handlePurchase(pkg)}
                        disabled={purchasing === pkg.id}
                        className="bg-gradient-to-r from-purple-500 to-blue-500"
                      >
                        {purchasing === pkg.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          `$${pkg.price_usd}`
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
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
