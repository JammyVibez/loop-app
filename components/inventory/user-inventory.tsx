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
import { useInventoryRealtime } from "@/hooks/use-inventory-realtime"
import { Coins, Palette, Crown, Zap, Trash2, Eye, ShoppingBag } from "lucide-react"

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

  // Live inventory: purchases, applies and removals sync in instantly.
  useInventoryRealtime(user?.id, () => {
    void fetchInventory()
  })

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
    switch (String(rarity).toLowerCase()) {
      case "common":
        return "bg-slate-800 text-slate-300 border border-slate-700"
      case "rare":
        return "bg-blue-950/80 text-blue-300 border border-blue-500/40"
      case "epic":
        return "bg-purple-950/80 text-purple-300 border border-purple-500/40"
      case "legendary":
        return "bg-amber-950/80 text-amber-300 border border-amber-500/40"
      default:
        return "bg-slate-800 text-slate-300 border border-slate-700"
    }
  }

  const getRarityIcon = (type: string) => {
    if (String(type).includes("theme")) return <Palette className="w-4 h-4 text-cyan-400" />
    if (String(type).includes("frame") || String(type).includes("avatar")) return <Crown className="w-4 h-4 text-amber-400" />
    if (String(type).includes("badge")) return <Zap className="w-4 h-4 text-fuchsia-400" />
    if (String(type).includes("effect") || String(type).includes("animation")) return <Eye className="w-4 h-4 text-emerald-400" />
    return <Coins className="w-4 h-4 text-yellow-400" />
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
      <Card className="bg-slate-900/80 border-slate-800 text-slate-100 rounded-2xl">
        <CardContent className="p-10 text-center text-slate-400">
          Sign in to view your inventory.
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse bg-slate-900/80 border-slate-800 rounded-2xl">
            <CardContent className="p-6">
              <div className="mb-4 h-4 rounded bg-slate-800" />
              <div className="mb-4 h-20 rounded bg-slate-800" />
              <div className="h-8 rounded bg-slate-800" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-slate-900/80 border-slate-800 rounded-2xl">
        <CardContent className="p-6 text-center">
          <p className="mb-4 text-rose-400">{error}</p>
          <Button onClick={fetchInventory} className="bg-slate-800 text-slate-100 hover:bg-slate-700">Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  const renderCard = (item: InventoryItem) => {
    const primary = item.item_data?.colors?.primary || "#8b5cf6"
    const secondary = item.item_data?.colors?.secondary || "#06b6d4"
    return (
      <Card
        key={item.id}
        className={`relative overflow-hidden bg-slate-900/80 border transition-all duration-200 hover:border-slate-700 rounded-2xl shadow-lg text-slate-100 ${
          item.is_active ? "border-cyan-500/80 ring-2 ring-cyan-500/30 shadow-cyan-500/10" : "border-slate-800/80"
        }`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center space-x-2">
              {getRarityIcon(item.item_type)}
              <CardTitle className="truncate text-base font-semibold text-slate-100">{item.item_name}</CardTitle>
            </div>
            <Badge className={`${getRarityColor(item.rarity)} uppercase text-[10px] tracking-wider font-semibold px-2 py-0.5 rounded-full`}>
              {item.rarity || "common"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex h-28 items-center justify-center rounded-xl border border-white/5 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${primary}44, ${secondary}44)` }}
          >
            <div className="p-3 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/10 shadow-inner">
              {getRarityIcon(item.item_type)}
            </div>
          </div>
          <div className="flex space-x-2">
            {item.is_active ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeItem(item.id)}
                className="flex-1 bg-slate-950/60 border-slate-700/80 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 rounded-xl transition-all"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => applyItem(item.id)}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl shadow-md transition-all"
              >
                Apply
              </Button>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Acquired: {new Date(item.acquired_at || item.purchased_at || Date.now()).toLocaleDateString()}
          </div>
        </CardContent>
        {item.is_active && (
          <div className="absolute right-3 top-3">
            <Badge className="bg-cyan-500 text-slate-950 font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
              Active
            </Badge>
          </div>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/80 border-slate-800 text-slate-100 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16 border-2 border-cyan-500/40 shadow-md">
                <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                <AvatarFallback className="bg-slate-800 text-cyan-400 font-bold">{user?.display_name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-bold text-slate-100">{user?.display_name}</h2>
                <p className="text-sm text-cyan-400 font-medium">@{user?.username}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Equip themes & items purchased from the Coin Shop.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="mb-0.5 flex items-center justify-end space-x-1.5">
                  <Coins className="h-5 w-5 text-amber-400" />
                  <span className="text-2xl font-black text-amber-300">{user?.loop_coins || 0}</span>
                </div>
                <p className="text-xs text-slate-400 font-medium">Loop Coins</p>
              </div>
              <Link href="/shop">
                <Button className="rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-medium">
                  <ShoppingBag className="mr-2 h-4 w-4 text-cyan-400" /> Shop
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5">
          <TabsTrigger value="all" className="rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">All</TabsTrigger>
          <TabsTrigger value="theme" className="rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">Themes</TabsTrigger>
          <TabsTrigger value="avatar_frame" className="rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">Frames</TabsTrigger>
          <TabsTrigger value="badge" className="rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">Badges</TabsTrigger>
          <TabsTrigger value="effect" className="rounded-xl text-xs font-semibold data-[state=active]:bg-cyan-500 data-[state=active]:text-slate-950 text-slate-400 transition-all">Effects</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6 mt-6">
          {inventory.length === 0 ? (
            <Card className="bg-slate-900/80 border-slate-800 rounded-2xl text-slate-100">
              <CardContent className="p-12 text-center">
                <Coins className="mx-auto mb-4 h-16 w-16 text-slate-700" />
                <h3 className="mb-2 text-xl font-semibold text-slate-200">No Items Yet</h3>
                <p className="mb-4 text-sm text-slate-400">Visit the coin shop to purchase themes, avatar frames, and special effects.</p>
                <Link href="/shop">
                  <Button className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl">
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
          <TabsContent key={type} value={type} className="space-y-6 mt-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {(groupedInventory[type] || []).map(renderCard)}
            </div>
            {(groupedInventory[type] || []).length === 0 && (
              <p className="py-12 text-center text-sm text-slate-400 bg-slate-900/40 border border-slate-800/60 rounded-2xl">No {type.replace("_", " ")} items in inventory.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
