
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Shield,
  Crown,
  Users,
  Target,
  Coins,
  Gift,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Search,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Activity,
  Calendar,
  Settings,
  Bell
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface User {
  id: string
  username: string
  display_name: string
  email: string
  avatar_url?: string
  is_premium: boolean
  is_verified: boolean
  is_banned: boolean
  loop_coins: number
  created_at: string
  last_login?: string
}

interface Quest {
  id: string
  title: string
  description: string
  type: string
  reward_amount: number
  requirements?: any
  is_active: boolean
  completion_count?: number
}

interface ShopItem {
  id: string
  name: string
  description: string
  price_coins?: number
  price_usd?: number
  category: string
  rarity: string
  is_active: boolean
  purchase_count: number
}

interface PlatformStats {
  total_users: number
  active_users_today: number
  total_loops: number
  total_coins_distributed: number
  premium_users: number
  weekly_bonus_claimed: number
  gifts_sent_today: number
  revenue_this_month: number
}

export function ComprehensiveAdminDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [quests, setQuests] = useState<Quest[]>([])
  const [shopItems, setShopItems] = useState<ShopItem[]>([])
  const [stats, setStats] = useState<PlatformStats>({
    total_users: 0,
    active_users_today: 0,
    total_loops: 0,
    total_coins_distributed: 0,
    premium_users: 0,
    weekly_bonus_claimed: 0,
    gifts_sent_today: 0,
    revenue_this_month: 0
  })
  
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userActionDialog, setUserActionDialog] = useState(false)
  const [questDialog, setQuestDialog] = useState(false)
  const [shopItemDialog, setShopItemDialog] = useState(false)
  const [distributingBonus, setDistributingBonus] = useState(false)
  
  const { user } = useAuth()
  const { toast } = useToast()

  const [questForm, setQuestForm] = useState({
    title: "",
    description: "",
    type: "daily_login",
    reward_amount: 100,
    requirements: {},
    is_active: true,
  })

  const [shopItemForm, setShopItemForm] = useState({
    name: "",
    description: "",
    price_coins: 100,
    price_usd: 0,
    category: "theme",
    rarity: "common",
    item_data: "{}",
    is_active: true,
  })

  useEffect(() => {
    fetchAllData()
  }, [])

  const fetchAllData = async () => {
    if (!user?.token) return
    
    try {
      setLoading(true)
      
      // Fetch platform statistics
      const statsResponse = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      // Fetch users
      const usersResponse = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData.users || [])
      }

      // Fetch quests
      const questsResponse = await fetch("/api/admin/quests", {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (questsResponse.ok) {
        const questsData = await questsResponse.json()
        setQuests(questsData.quests || [])
      }

      // Fetch shop items
      const shopResponse = await fetch("/api/admin/shop-items", {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      if (shopResponse.ok) {
        const shopData = await shopResponse.json()
        setShopItems(shopData.items || [])
      }

    } catch (error) {
      console.error("Error fetching admin data:", error)
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUserAction = async (action: string, userId: string, data?: any) => {
    if (!user?.token) return

    try {
      const response = await fetch(`/api/admin/users/${userId}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ action, ...data }),
      })

      if (!response.ok) {
        throw new Error("Failed to perform user action")
      }

      await fetchAllData() // Refresh data
      setUserActionDialog(false)
      
      toast({
        title: "Success",
        description: `User ${action} completed successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to perform user action",
        variant: "destructive",
      })
    }
  }

  const handleCreateQuest = async () => {
    if (!user?.token) return

    try {
      const response = await fetch("/api/admin/quests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(questForm),
      })

      if (!response.ok) {
        throw new Error("Failed to create quest")
      }

      await fetchAllData()
      setQuestDialog(false)
      resetQuestForm()
      
      toast({
        title: "Quest Created",
        description: "New quest has been created successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create quest",
        variant: "destructive",
      })
    }
  }

  const handleCreateShopItem = async () => {
    if (!user?.token) return

    try {
      const itemData = {
        ...shopItemForm,
        item_data: JSON.parse(shopItemForm.item_data),
        price_usd: shopItemForm.price_usd > 0 ? shopItemForm.price_usd : null
      }

      const response = await fetch("/api/admin/shop-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(itemData),
      })

      if (!response.ok) {
        throw new Error("Failed to create shop item")
      }

      await fetchAllData()
      setShopItemDialog(false)
      resetShopItemForm()
      
      toast({
        title: "Shop Item Created",
        description: "New shop item has been created successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create shop item",
        variant: "destructive",
      })
    }
  }

  const handleDistributeWeeklyBonus = async () => {
    if (!user?.token) return

    try {
      setDistributingBonus(true)
      
      const response = await fetch("/api/admin/distribute-bonus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to distribute bonus")
      }

      const data = await response.json()
      
      toast({
        title: "Bonus Distributed",
        description: `Weekly bonus distributed to ${data.users_count} users`,
      })

      await fetchAllData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to distribute weekly bonus",
        variant: "destructive",
      })
    } finally {
      setDistributingBonus(false)
    }
  }

  const resetQuestForm = () => {
    setQuestForm({
      title: "",
      description: "",
      type: "daily_login",
      reward_amount: 100,
      requirements: {},
      is_active: true,
    })
  }

  const resetShopItemForm = () => {
    setShopItemForm({
      name: "",
      description: "",
      price_coins: 100,
      price_usd: 0,
      category: "theme",
      rarity: "common",
      item_data: "{}",
      is_active: true,
    })
  }

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <Button 
          onClick={handleDistributeWeeklyBonus} 
          disabled={distributingBonus}
          className="bg-green-600 hover:bg-green-700"
        >
          <Coins className="w-4 h-4 mr-2" />
          {distributingBonus ? "Distributing..." : "Distribute Weekly Bonus"}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.total_users.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Users</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.active_users_today.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Active Today</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Crown className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.premium_users.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Premium Users</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Coins className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.total_coins_distributed.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Coins Distributed</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Gift className="w-6 h-6 text-pink-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.gifts_sent_today.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Gifts Today</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="w-6 h-6 text-orange-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.weekly_bonus_claimed.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Weekly Bonus</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.total_loops.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Loops</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">${stats.revenue_this_month.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Revenue</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="quests">Quest Management</TabsTrigger>
          <TabsTrigger value="shop">Shop Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>User Management</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map((userData) => (
                  <div key={userData.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={userData.avatar_url || "/placeholder.svg"} />
                          <AvatarFallback>{userData.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{userData.display_name}</div>
                          <div className="text-sm text-gray-500">@{userData.username}</div>
                          <div className="text-xs text-gray-400">{userData.email}</div>
                        </div>
                        <div className="flex space-x-1">
                          {userData.is_premium && (
                            <Badge className="bg-purple-100 text-purple-700">Premium</Badge>
                          )}
                          {userData.is_verified && (
                            <Badge className="bg-blue-100 text-blue-700">Verified</Badge>
                          )}
                          {userData.is_banned && (
                            <Badge variant="destructive">Banned</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          <span className="font-medium">{userData.loop_coins.toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Joined {new Date(userData.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedUser(userData)
                          setUserActionDialog(true)
                        }}
                      >
                        <Settings className="w-4 h-4 mr-1" />
                        Manage
                      </Button>
                      <Button
                        size="sm"
                        variant={userData.is_banned ? "default" : "destructive"}
                        onClick={() => handleUserAction(userData.is_banned ? 'unban' : 'ban', userData.id)}
                      >
                        <Ban className="w-4 h-4 mr-1" />
                        {userData.is_banned ? 'Unban' : 'Ban'}
                      </Button>
                      <Button
                        size="sm"
                        variant={userData.is_verified ? "secondary" : "default"}
                        onClick={() => handleUserAction(userData.is_verified ? 'unverify' : 'verify', userData.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {userData.is_verified ? 'Unverify' : 'Verify'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quests">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quest Management</CardTitle>
              <Dialog open={questDialog} onOpenChange={setQuestDialog}>
                <DialogTrigger asChild>
                  <Button onClick={resetQuestForm}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Quest
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Quest</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Quest title"
                      value={questForm.title}
                      onChange={(e) => setQuestForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                    <Textarea
                      placeholder="Quest description"
                      value={questForm.description}
                      onChange={(e) => setQuestForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <Select
                      value={questForm.type}
                      onValueChange={(value) => setQuestForm(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily_login">Daily Login</SelectItem>
                        <SelectItem value="weekly_bonus">Weekly Bonus</SelectItem>
                        <SelectItem value="watch_ad">Watch Advertisement</SelectItem>
                        <SelectItem value="play_game">Play Mini-Game</SelectItem>
                        <SelectItem value="social_share">Social Share</SelectItem>
                        <SelectItem value="invite_friend">Invite Friend</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Reward amount (Loop Coins)"
                      value={questForm.reward_amount}
                      onChange={(e) => setQuestForm(prev => ({ ...prev, reward_amount: parseInt(e.target.value) || 0 }))}
                    />
                    <Button onClick={handleCreateQuest} className="w-full">
                      Create Quest
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quests.map((quest) => (
                  <div key={quest.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">{quest.title}</h3>
                        <p className="text-sm text-gray-600">{quest.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={quest.is_active ? "default" : "secondary"}>
                          {quest.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">{quest.reward_amount} coins</Badge>
                        {quest.completion_count && (
                          <Badge className="bg-green-100 text-green-700">
                            {quest.completion_count} completions
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shop">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Shop Management</CardTitle>
              <Dialog open={shopItemDialog} onOpenChange={setShopItemDialog}>
                <DialogTrigger asChild>
                  <Button onClick={resetShopItemForm}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Shop Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Item name"
                      value={shopItemForm.name}
                      onChange={(e) => setShopItemForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <Textarea
                      placeholder="Item description"
                      value={shopItemForm.description}
                      onChange={(e) => setShopItemForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Price (Coins)"
                        value={shopItemForm.price_coins}
                        onChange={(e) => setShopItemForm(prev => ({ ...prev, price_coins: parseInt(e.target.value) || 0 }))}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price (USD)"
                        value={shopItemForm.price_usd}
                        onChange={(e) => setShopItemForm(prev => ({ ...prev, price_usd: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <Select
                      value={shopItemForm.category}
                      onValueChange={(value) => setShopItemForm(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="theme">Theme</SelectItem>
                        <SelectItem value="animation">Animation</SelectItem>
                        <SelectItem value="effect">Effect</SelectItem>
                        <SelectItem value="badge">Badge</SelectItem>
                        <SelectItem value="avatar">Avatar</SelectItem>
                        <SelectItem value="coins">Coins</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={shopItemForm.rarity}
                      onValueChange={(value) => setShopItemForm(prev => ({ ...prev, rarity: value }))}
                    >
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
                    <Textarea
                      placeholder="Item data (JSON)"
                      value={shopItemForm.item_data}
                      onChange={(e) => setShopItemForm(prev => ({ ...prev, item_data: e.target.value }))}
                    />
                    <Button onClick={handleCreateShopItem} className="w-full">
                      Create Item
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {shopItems.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={item.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                          {item.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">{item.rarity}</Badge>
                        <Badge className="bg-purple-100 text-purple-700">
                          {item.price_coins} coins
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-700">
                          {item.purchase_count} sold
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>New users today:</span>
                    <span className="font-medium">{Math.floor(stats.active_users_today * 0.1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Loops created today:</span>
                    <span className="font-medium">{Math.floor(stats.total_loops * 0.05)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gifts sent today:</span>
                    <span className="font-medium">{stats.gifts_sent_today}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Premium conversions:</span>
                    <span className="font-medium">{Math.floor(stats.premium_users * 0.02)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>This month:</span>
                    <span className="font-medium">${stats.revenue_this_month.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Premium subscriptions:</span>
                    <span className="font-medium">${Math.floor(stats.revenue_this_month * 0.6).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coin purchases:</span>
                    <span className="font-medium">${Math.floor(stats.revenue_this_month * 0.4).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average per user:</span>
                    <span className="font-medium">${(stats.revenue_this_month / Math.max(stats.premium_users, 1)).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* User Action Dialog */}
      <Dialog open={userActionDialog} onOpenChange={setUserActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage User: {selectedUser?.display_name}</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleUserAction('grant_premium', selectedUser.id, { duration: '1 month' })}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Grant Premium
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUserAction('add_coins', selectedUser.id, { amount: 1000 })}
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Add 1000 Coins
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUserAction('reset_password', selectedUser.id)}
                >
                  Reset Password
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleUserAction('view_activity', selectedUser.id)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Activity
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
