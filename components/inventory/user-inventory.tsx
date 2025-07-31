"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Coins, Palette, Crown, Sparkles, Trash2, Eye } from "lucide-react"

interface InventoryItem {
  id: string
  item_id: string
  item_name: string
  item_type: "theme" | "avatar_frame" | "badge" | "effect"
  item_data: any
  is_active: boolean
  purchased_at: string
  rarity: "common" | "rare" | "epic" | "legendary"
}

export function UserInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/inventory", {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch inventory")
      }

      const data = await response.json()
      setInventory(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory")
      console.error("Error fetching inventory:", err)
    } finally {
      setLoading(false)
    }
  }

  const applyItem = async (itemId: string) => {
    try {
      const response = await fetch("/api/inventory/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ item_id: itemId }),
      })

      if (!response.ok) {
        throw new Error("Failed to apply item")
      }

      await fetchInventory()
      toast({ description: "Item applied successfully!" })
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to apply item",
        variant: "destructive",
      })
    }
  }

  const removeItem = async (itemId: string) => {
    try {
      const response = await fetch("/api/inventory/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ item_id: itemId }),
      })

      if (!response.ok) {
        throw new Error("Failed to remove item")
      }

      await fetchInventory()
      toast({ description: "Item removed successfully!" })
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to remove item",
        variant: "destructive",
      })
    }
  }

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common":
        return "bg-gray-500"
      case "rare":
        return "bg-blue-500"
      case "epic":
        return "bg-purple-500"
      case "legendary":
        return "bg-yellow-500"
      default:
        return "bg-gray-500"
    }
  }

  const getRarityIcon = (type: string) => {
    switch (type) {
      case "theme":
        return <Palette className="w-4 h-4" />
      case "avatar_frame":
        return <Crown className="w-4 h-4" />
      case "badge":
        return <Sparkles className="w-4 h-4" />
      case "effect":
        return <Eye className="w-4 h-4" />
      default:
        return <Coins className="w-4 h-4" />
    }
  }

  const groupedInventory = inventory.reduce(
    (acc, item) => {
      if (!acc[item.item_type]) {
        acc[item.item_type] = []
      }
      acc[item.item_type].push(item)
      return acc
    },
    {} as Record<string, InventoryItem[]>,
  )

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-4"></div>
              <div className="h-20 bg-gray-200 rounded mb-4"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchInventory}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* User Stats */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{user?.display_name}</h2>
                <p className="text-gray-600">@{user?.username}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-2 mb-2">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-bold">{user?.loop_coins || 0}</span>
              </div>
              <p className="text-sm text-gray-600">Loop Coins</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Items</TabsTrigger>
          <TabsTrigger value="theme">Themes</TabsTrigger>
          <TabsTrigger value="avatar_frame">Frames</TabsTrigger>
          <TabsTrigger value="badge">Badges</TabsTrigger>
          <TabsTrigger value="effect">Effects</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {inventory.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Coins className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Items Yet</h3>
                <p className="text-gray-600 mb-4">Visit the shop to purchase your first items!</p>
                <Button>Visit Shop</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventory.map((item) => (
                <Card key={item.id} className={`relative ${item.is_active ? "ring-2 ring-purple-500" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getRarityIcon(item.item_type)}
                        <CardTitle className="text-lg">{item.item_name}</CardTitle>
                      </div>
                      <Badge className={`${getRarityColor(item.rarity)} text-white`}>{item.rarity}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Item Preview */}
                    <div className="h-32 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                      {item.item_type === "theme" && (
                        <div className="text-center">
                          <Palette className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                          <p className="text-sm font-medium">{item.item_data?.name || "Theme Preview"}</p>
                        </div>
                      )}
                      {item.item_type === "avatar_frame" && (
                        <div className="relative">
                          <Avatar className="w-16 h-16">
                            <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                            <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="absolute inset-0 border-4 border-yellow-400 rounded-full animate-pulse"></div>
                        </div>
                      )}
                      {item.item_type === "badge" && (
                        <div className="text-center">
                          <Sparkles className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                          <p className="text-sm font-medium">{item.item_data?.name || "Badge"}</p>
                        </div>
                      )}
                      {item.item_type === "effect" && (
                        <div className="text-center">
                          <Eye className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                          <p className="text-sm font-medium">{item.item_data?.name || "Effect"}</p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      {item.is_active ? (
                        <Button variant="outline" size="sm" onClick={() => removeItem(item.id)} className="flex-1">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => applyItem(item.id)}
                          className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                        >
                          Apply
                        </Button>
                      )}
                    </div>

                    <div className="text-xs text-gray-500">
                      Purchased: {new Date(item.purchased_at).toLocaleDateString()}
                    </div>
                  </CardContent>
                  {item.is_active && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-500 text-white">Active</Badge>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {Object.entries(groupedInventory).map(([type, items]) => (
          <TabsContent key={type} value={type} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <Card key={item.id} className={`relative ${item.is_active ? "ring-2 ring-purple-500" : ""}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getRarityIcon(item.item_type)}
                        <CardTitle className="text-lg">{item.item_name}</CardTitle>
                      </div>
                      <Badge className={`${getRarityColor(item.rarity)} text-white`}>{item.rarity}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="h-32 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center">
                      {getRarityIcon(item.item_type)}
                    </div>
                    <div className="flex space-x-2">
                      {item.is_active ? (
                        <Button variant="outline" size="sm" onClick={() => removeItem(item.id)} className="flex-1">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => applyItem(item.id)}
                          className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  </CardContent>
                  {item.is_active && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-500 text-white">Active</Badge>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
