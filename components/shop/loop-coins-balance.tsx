"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Coins, Plus, Star, Loader2, Zap, Crown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

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

const rarityConfig: Record<string, { ring: string; bg: string; icon: React.ReactNode; label: string }> = {
  common: { ring: "", bg: "bg-slate-50 dark:bg-slate-900", icon: <Coins className="w-4 h-4 text-slate-400" />, label: "" },
  rare: { ring: "ring-2 ring-blue-500/40", bg: "bg-blue-50/50 dark:bg-blue-950/30", icon: <Zap className="w-4 h-4 text-blue-500" />, label: "Popular" },
  epic: { ring: "ring-2 ring-purple-500/40", bg: "bg-purple-50/50 dark:bg-purple-950/30", icon: <Zap className="w-4 h-4 text-purple-500" />, label: "Best Value" },
  legendary: { ring: "ring-2 ring-amber-500/40", bg: "bg-amber-50/50 dark:bg-amber-950/30", icon: <Crown className="w-4 h-4 text-amber-500" />, label: "Premium" },
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
      toast({ title: "Error", description: "Failed to load coin packages", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (pkg: CoinPackage) => {
    if (!user?.token) {
      toast({ title: "Authentication Required", description: "Please log in to purchase coins.", variant: "destructive" })
      return
    }
    setPurchasing(pkg.id)
    try {
      const response = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ item_id: pkg.id, payment_method: "stripe" }),
      })
      const data = await response.json()
      if (data.success && data.checkout_url) {
        toast({ title: "Redirecting to Payment", description: "You'll be redirected to complete your purchase." })
        window.location.href = data.checkout_url
      } else {
        toast({ title: "Purchase Failed", description: data.error || "Failed to initiate purchase", variant: "destructive" })
      }
    } catch (error) {
      console.error("Error purchasing coins:", error)
      toast({ title: "Purchase Failed", description: "An error occurred while processing your purchase", variant: "destructive" })
    } finally {
      setPurchasing(null)
    }
  }

  const formatCoins = (coins: number) => {
    if (coins >= 1000000) return (coins / 1000000).toFixed(1) + "M"
    if (coins >= 1000) return (coins / 1000).toFixed(coins >= 10000 ? 0 : 1) + "K"
    return coins.toString()
  }

  const sortedPackages = [...coinPackages].sort((a, b) => a.item_data.coins_amount - b.item_data.coins_amount)

  if (!showDetails) {
    return (
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex items-center space-x-2">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-semibold">{formatCoins(user?.loop_coins || 0)}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span>Get Loop Coins</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              sortedPackages.map((pkg) => {
                const config = rarityConfig[pkg.rarity] || rarityConfig.common
                const total = pkg.item_data.coins_amount + pkg.item_data.bonus
                return (
                  <Card
                    key={pkg.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${config.ring} ${config.bg}`}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {pkg.item_data.coins_amount >= 10000 ? "👑" : pkg.item_data.coins_amount >= 1000 ? "💰" : "🪙"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm">{total.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">coins</span>
                              {config.label && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                  {config.icon}
                                  <span className="ml-0.5">{config.label}</span>
                                </Badge>
                              )}
                            </div>
                            {pkg.item_data.bonus > 0 && (
                              <p className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                                +{pkg.item_data.bonus.toLocaleString()} bonus included
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handlePurchase(pkg)}
                          disabled={purchasing === pkg.id}
                          className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-full px-4"
                        >
                          {purchasing === pkg.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            `$${pkg.price_usd}`
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
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
