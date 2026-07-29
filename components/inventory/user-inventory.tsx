"use client"
import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Coins, Palette, Crown, Sparkles, Trash2, Eye, ShoppingBag } from "lucide-react"

interface InventoryItem {
  id: string
  item_id: string
  item_name: string
  item_type: string
  item_data: any
  is_active: boolean
  purchased_at?: string
  acquired_at?: string
  rarity: "common" | "rare" | "epic" | "legendary" | string
}

export function UserInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const fetchInventory = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/inventory", {
        headers: getAuthHeader(),
        cache: "no-store",
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch inventory")
      }

      setInventory(data.items || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory")
      console.error("Error fetching inventory:", err)
    } finally {
      setLoading(false)
    }
  }, [user?.id, getAuthHeader])

  useEffect(() => {
    void fetchInventory()
  }, [fetchInventory])

  const applyItem = async (itemId: string) => {
    try {
      const response = await fetch("/api/inventory/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ inventory_item_id: itemId }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Failed to apply item")
      }

      if (data.theme && typeof window !== "undefined") {
        localStorage.setItem("loop-3d-theme", data.theme.id)
        localStorage.setItem("loop-3d-custom-theme", JSON.stringify(data.theme))
        window.dispatchEvent(new CustomEvent("loop-theme-applied", { detail: data.theme }))
      }

      if (typeof window !== "undefined" && data.cosmetics) {
        window.dispatchEvent(new CustomEvent("loop-cosmetics-applied", { detail: data.cosmetics }))
      }

      await fetchInventory()
      toast({
        title: "Applied",
        description: data.theme
          ? "Accent theme applied. Light/dark mode still works from Settings."
          : "Badge/effect is now active on your profile.",
      })
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
          ...getAuthHeader(),
        },
        body: JSON.stringify({ inventory_item_id: itemId }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove item")
      }

      if (typeof window !== "undefined") {
        if (data.cleared_theme) {
          localStorage.removeItem("loop-3d-custom-theme")
          localStorage.removeItem("loop-3d-theme")
          window.dispatchEvent(new CustomEvent("loop-theme-applied", { detail: null }))
        }
        if (data.cosmetics) {
          window.dispatchEvent(new CustomEvent("loop-cosmetics-applied", { detail: data.cosmetics }))
        }
      }

      await fetchInventory()
      toast({ description: "Item deactivated." })
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
    if (String(type).includes("theme")) return <Palette className="w-4 h-4" />
    if (String(type).includes("frame") || String(type).includes("avatar")) return <Crown className="w-4 h-4" />
    if (String(type).includes("badge")) return <Sparkles className="w-4 h-4" />
    if (String(type).includes("effect") || String(type).includes("animation")) return <Eye className="w-4 h-4" />
    return <Coins className="w-4 h-4" />
  }

  const tabType = (item: InventoryItem) => {
    const t = String(item.item_type || "").toLowerCase()
    if (t.includes("theme")) return "theme"
    if (t.includes("frame") || t.includes("avatar")) return "avatar_frame"
    if (t.includes("badge")) return "badge"
    if (t.includes("effect") || t.includes("animation")) return "effect"
    return "effect"
  }

  const groupedInventory = inventory.reduce(
    (acc, item) => {
      const key = tabType(item)
      if (!acc[key]) acc[key] = []
      acc[key].push(item)
      return acc
    },
    {} as Record<string, InventoryItem[]>,
  )

  if (!user) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-muted-foreground">
          Sign in to view your inventory.
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="mb-4 h-4 rounded bg-muted" />
              <div className="mb-4 h-20 rounded bg-muted" />
              <div className="h-8 rounded bg-muted" />
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
          <p className="mb-4 text-red-600">{error}</p>
          <Button onClick={fetchInventory}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  const renderCard = (item: InventoryItem) => {
    const primary = item.item_data?.colors?.primary || "#8b5cf6"
    const secondary = item.item_data?.colors?.secondary || "#06b6d4"
    return (
      <Card key={item.id} className={`relative ${item.is_active ? "ring-2 ring-violet-500" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center space-x-2">
              {getRarityIcon(item.item_type)}
              <CardTitle className="truncate text-lg">{item.item_name}</CardTitle>
            </div>
            <Badge className={`${getRarityColor(item.rarity)} text-white`}>{item.rarity || "common"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex h-32 items-center justify-center rounded-lg"
            style={{ background: `linear-gradient(135deg, ${primary}55, ${secondary}55)` }}
          >
            {getRarityIcon(item.item_type)}
          </div>
          <div className="flex space-x-2">
            {item.is_active ? (
              <Button variant="outline" size="sm" onClick={() => removeItem(item.id)} className="flex-1">
                <Trash2 className="mr-2 h-4 w-4" />
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => applyItem(item.id)}
                className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-500"
              >
                Apply
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Acquired: {new Date(item.acquired_at || item.purchased_at || Date.now()).toLocaleDateString()}
          </div>
        </CardContent>
        {item.is_active && (
          <div className="absolute right-2 top-2">
            <Badge className="bg-emerald-500 text-white">Active</Badge>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-2xl font-bold">{user?.display_name}</h2>
                <p className="text-muted-foreground">@{user?.username}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Apply themes & effects you bought in the Shop.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="mb-1 flex items-center justify-end space-x-2">
                  <Coins className="h-5 w-5 text-yellow-500" />
                  <span className="text-2xl font-bold">{user?.loop_coins || 0}</span>
                </div>
                <p className="text-sm text-muted-foreground">Loop Coins</p>
              </div>
              <Link href="/shop">
                <Button className="rounded-full">
                  <ShoppingBag className="mr-2 h-4 w-4" /> Shop
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="theme">Themes</TabsTrigger>
          <TabsTrigger value="avatar_frame">Frames</TabsTrigger>
          <TabsTrigger value="badge">Badges</TabsTrigger>
          <TabsTrigger value="effect">Effects</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          {inventory.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Coins className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
                <h3 className="mb-2 text-xl font-semibold">No Items Yet</h3>
                <p className="mb-4 text-muted-foreground">Visit the shop to purchase themes and effects.</p>
                <Link href="/shop">
                  <Button>
                    <ShoppingBag className="mr-2 h-4 w-4" /> Visit Shop
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {inventory.map(renderCard)}
            </div>
          )}
        </TabsContent>

        {(["theme", "avatar_frame", "badge", "effect"] as const).map((type) => (
          <TabsContent key={type} value={type} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {(groupedInventory[type] || []).map(renderCard)}
            </div>
            {(groupedInventory[type] || []).length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No {type.replace("_", " ")} items yet.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
