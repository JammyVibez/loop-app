"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, Coins, TrendingUp } from "lucide-react"

interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  type: string
  rarity: string
  is_active: boolean
  created_at: string
  sales_count: number
}

export function ShopManagement() {
  const [items, setItems] = useState<ShopItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    price: 0,
    type: "theme",
    rarity: "common",
    image_url: "",
  })
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchShopItems()
  }, [])

  const fetchShopItems = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/shop-items", {
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch shop items")
      }

      const data = await response.json()
      setItems(data.items || [])
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load shop items",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const createItem = async () => {
    try {
      const response = await fetch("/api/admin/shop-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify(newItem),
      })

      if (!response.ok) {
        throw new Error("Failed to create item")
      }

      await fetchShopItems()
      setShowCreateDialog(false)
      setNewItem({
        name: "",
        description: "",
        price: 0,
        type: "theme",
        rarity: "common",
        image_url: "",
      })
      toast({ description: "Item created successfully!" })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create item",
        variant: "destructive",
      })
    }
  }

  const distributeWeeklyRewards = async () => {
    try {
      const response = await fetch("/api/admin/users/coins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ action: "weekly_reward" }),
      })

      if (!response.ok) {
        throw new Error("Failed to distribute rewards")
      }

      const data = await response.json()
      toast({
        description: `Weekly rewards distributed to ${data.users_rewarded} users!`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to distribute rewards",
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

  if (loading) {
    return <div className="text-center py-8">Loading shop management...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Shop Management</h2>
        <div className="flex space-x-2">
          <Button onClick={distributeWeeklyRewards} variant="outline">
            <Coins className="w-4 h-4 mr-2" />
            Weekly Rewards
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Shop Item</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Item description"
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price (Loop Coins)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: Number.parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={newItem.type} onValueChange={(value) => setNewItem({ ...newItem, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="theme">Theme</SelectItem>
                      <SelectItem value="avatar_frame">Avatar Frame</SelectItem>
                      <SelectItem value="badge">Badge</SelectItem>
                      <SelectItem value="effect">Effect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rarity">Rarity</Label>
                  <Select value={newItem.rarity} onValueChange={(value) => setNewItem({ ...newItem, rarity: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input
                    id="image_url"
                    value={newItem.image_url}
                    onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <Button onClick={createItem} className="w-full">
                  Create Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Shop Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{item.name}</CardTitle>
                <Badge className={`${getRarityColor(item.rarity)} text-white`}>{item.rarity}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{item.description}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className="font-semibold">{item.price}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm">{item.sales_count} sold</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>

              <div className="text-xs text-gray-500">Created: {new Date(item.created_at).toLocaleDateString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Plus className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Shop Items</h3>
            <p className="text-gray-600 mb-4">Create your first shop item to get started!</p>
            <Button onClick={() => setShowCreateDialog(true)}>Create First Item</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
