"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Shield,
  Crown,
  Flag,
  Users,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  Settings,
  BarChart3,
  DollarSign,
  Gift,
  MessageSquare,
  Ban,
  UserCheck,
  Upload,
  Image,
  Palette,
  Sparkles,
  Coins,
  TrendingUp,
  Activity,
  Calendar,
  Search,
  Filter,
  Download,
  Trash2,
  Edit,
  Plus,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SettingsTabContent } from "./settings-tab-content"
import { useAuth } from "@/hooks/use-auth"

interface AdminStats {
  totalUsers: number
  activeUsers: number
  premiumUsers: number
  totalRevenue: number
  pendingReports: number
  pendingVerifications: number
  totalGifts: number
  totalShopItems: number
}

interface ShopItemForm {
  name: string
  description: string
  price: number
  price_coins?: number
  category: string
  item_type: string
  rarity: string
  premium_only: boolean
  item_data: any
  preview_data?: any
  image_url?: string
  animation_url?: string
}

export function EnhancedAdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    premiumUsers: 0,
    totalRevenue: 0,
    pendingReports: 0,
    pendingVerifications: 0,
    totalGifts: 0,
    totalShopItems: 0,
  })
  const [showCreateItemDialog, setShowCreateItemDialog] = useState(false)
  const [newShopItem, setNewShopItem] = useState<ShopItemForm>({
    name: '',
    description: '',
    price: 0,
    price_coins: 0,
    category: 'theme',
    item_type: 'cosmetic',
    rarity: 'common',
    premium_only: false,
    item_data: {},
    preview_data: {},
  })
  const [shopItems, setShopItems] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      
      // Fetch admin statistics
      const statsResponse = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${user?.token}` },
      })
      const statsData = await statsResponse.json()
      if (statsData.success) {
        setStats(statsData.stats)
      }

      // Fetch shop items
      const itemsResponse = await fetch('/api/admin/shop-items', {
        headers: { Authorization: `Bearer ${user?.token}` },
      })
      const itemsData = await itemsResponse.json()
      if (itemsData.success) {
        setShopItems(itemsData.items)
      }

      // Fetch users
      const usersResponse = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${user?.token}` },
      })
      const usersData = await usersResponse.json()
      if (usersData.success) {
        setUsers(usersData.users)
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateShopItem = async () => {
    try {
      const response = await fetch('/api/admin/shop-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify(newShopItem),
      })

      const data = await response.json()
      if (data.success) {
        toast({
          title: "Shop Item Created",
          description: `${newShopItem.name} has been added to the shop`,
        })
        setShowCreateItemDialog(false)
        setNewShopItem({
          name: '',
          description: '',
          price: 0,
          price_coins: 0,
          category: 'theme',
          item_type: 'cosmetic',
          rarity: 'common',
          premium_only: false,
          item_data: {},
          preview_data: {},
        })
        fetchAdminData()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to create shop item",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error creating shop item:', error)
      toast({
        title: "Error",
        description: "Failed to create shop item",
        variant: "destructive",
      })
    }
  }

  const handleUserAction = async (userId: string, action: 'ban' | 'unban' | 'premium' | 'verify') => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token}` },
      })

      const data = await response.json()
      if (data.success) {
        toast({
          title: "Action Completed",
          description: `User ${action} action completed successfully`,
        })
        fetchAdminData()
      } else {
        toast({
          title: "Error",
          description: data.error || `Failed to ${action} user`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(`Error ${action} user:`, error)
      toast({
        title: "Error",
        description: `Failed to ${action} user`,
        variant: "destructive",
      })
    }
  }

  const handleGiveCoins = async (userId: string, amount: number) => {
    try {
      const response = await fetch('/api/admin/users/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ user_id: userId, amount }),
      })

      const data = await response.json()
      if (data.success) {
        toast({
          title: "Coins Added",
          description: `${amount} coins added to user account`,
        })
        fetchAdminData()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to add coins",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error adding coins:', error)
      toast({
        title: "Error",
        description: "Failed to add coins",
        variant: "destructive",
      })
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.display_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterStatus === 'all') return matchesSearch
    if (filterStatus === 'premium') return matchesSearch && user.is_premium
    if (filterStatus === 'banned') return matchesSearch && user.is_banned
    if (filterStatus === 'verified') return matchesSearch && user.is_verified
    
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Enhanced Admin Dashboard</h1>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowCreateItemDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Shop Item
          </Button>
          <Button variant="outline" onClick={fetchAdminData}>
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Users</div>
            <div className="text-xs text-green-600 mt-1">
              {stats.activeUsers} active today
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <Crown className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.premiumUsers.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Premium Users</div>
            <div className="text-xs text-purple-600 mt-1">
              {((stats.premiumUsers / stats.totalUsers) * 100).toFixed(1)}% conversion
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <DollarSign className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Revenue</div>
            <div className="text-xs text-green-600 mt-1">
              This month: ${(stats.totalRevenue * 0.15).toFixed(0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 text-center">
            <Gift className="w-8 h-8 text-pink-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.totalGifts.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Gifts Sent</div>
            <div className="text-xs text-pink-600 mt-1">
              {stats.totalShopItems} shop items
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="shop">Shop Items</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Users Management */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Management</CardTitle>
                <div className="flex space-x-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="banned">Banned</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>{user.display_name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">{user.display_name}</span>
                            {user.is_premium && <Crown className="w-4 h-4 text-purple-500" />}
                            {user.is_verified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                            {user.is_banned && <Ban className="w-4 h-4 text-red-500" />}
                          </div>
                          <div className="text-sm text-gray-500">
                            @{user.username} • {user.loop_coins || 0} coins
                          </div>
                          <div className="text-xs text-gray-400">
                            Joined: {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGiveCoins(user.id, 100)}
                        >
                          <Coins className="w-4 h-4 mr-1" />
                          +100
                        </Button>
                        
                        {!user.is_premium && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUserAction(user.id, 'premium')}
                          >
                            <Crown className="w-4 h-4 mr-1" />
                            Premium
                          </Button>
                        )}
                        
                        {!user.is_verified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUserAction(user.id, 'verify')}
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Verify
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant={user.is_banned ? "default" : "destructive"}
                          onClick={() => handleUserAction(user.id, user.is_banned ? 'unban' : 'ban')}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          {user.is_banned ? 'Unban' : 'Ban'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shop Items Management */}
        <TabsContent value="shop">
          <Card>
            <CardHeader>
              <CardTitle>Shop Items Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shopItems.map((item) => (
                  <Card key={item.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={`${
                          item.rarity === 'legendary' ? 'bg-yellow-100 text-yellow-800' :
                          item.rarity === 'epic' ? 'bg-purple-100 text-purple-800' :
                          item.rarity === 'rare' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.rarity}
                        </Badge>
                        <div className="flex space-x-1">
                          <Button size="sm" variant="ghost">
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text
