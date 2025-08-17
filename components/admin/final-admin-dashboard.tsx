"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  UserX,
  UserPlus,
  Clock,
  Star,
  ShoppingCart,
  Palette as PaletteIcon,
  UploadCloud,
  DownloadCloud,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SettingsTabContent } from "./settings-tab-content";
import { ContentModerationControl } from "./content-moderation-control";
import { ShopManagement } from "./shop-management";
import { ThemeManagement } from "./theme-management";
import { useAuth } from "@/hooks/use-auth";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  premiumUsers: number;
  totalRevenue: number;
  pendingReports: number;
  pendingVerifications: number;
  totalGifts: number;
  totalShopItems: number;
}

interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  is_premium: boolean;
  is_verified: boolean;
  is_banned: boolean;
  loop_coins: number;
  created_at: string;
  last_active: string;
  banned_until?: string;
  ban_reason?: string;
}

export function FinalAdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    premiumUsers: 0,
    totalRevenue: 0,
    pendingReports: 0,
    pendingVerifications: 0,
    totalGifts: 0,
    totalShopItems: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      
      // Fetch admin statistics
      const statsResponse = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const statsData = await statsResponse.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Fetch users
      const usersResponse = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      const usersData = await usersResponse.json();
      if (usersData.success) {
        setUsers(usersData.users);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (userId: string, action: 'ban' | 'unban' | 'premium' | 'verify' | 'suspend') => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Action Completed",
          description: `User ${action} action completed successfully`,
        });
        fetchAdminData();
      } else {
        toast({
          title: "Error",
          description: data.error || `Failed to ${action} user`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(`Error ${action} user:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} user`,
        variant: "destructive",
      });
    }
  };

  const handleGiveCoins = async (userId: string, amount: number) => {
    try {
      const response = await fetch('/api/admin/users/coins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({ user_id: userId, amount }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Coins Added",
          description: `${amount} coins added to user account`,
        });
        fetchAdminData();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to add coins",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error adding coins:', error);
      toast({
        title: "Error",
        description: "Failed to add coins",
        variant: "destructive",
      });
    }
  };

  const handleViewUserDetails = (user: User) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.display_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'premium') return matchesSearch && user.is_premium;
    if (filterStatus === 'banned') return matchesSearch && user.is_banned;
    if (filterStatus === 'verified') return matchesSearch && user.is_verified;
    if (filterStatus === 'suspended') return matchesSearch && user.is_banned;
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Complete Admin Dashboard</h1>
        </div>
        <div className="flex space-x-2">
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
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="shop">Shop Items</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="moderation">Content Moderation</TabsTrigger>
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
                      <SelectItem value="suspended">Suspended</SelectItem>
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
                          {user.is_banned && user.banned_until && (
                            <div className="text-xs text-red-500">
                              Banned until: {new Date(user.banned_until).toLocaleDateString()}
                            </div>
                          )}
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
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewUserDetails(user)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
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
          <ShopManagement />
        </TabsContent>

        {/* Themes Management */}
        <TabsContent value="themes">
          <ThemeManagement />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold">24</div>
                          <div className="text-sm text-gray-600">Pending Reports</div>
                        </div>
                        <Flag className="w-8 h-8 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold">12</div>
                          <div className="text-sm text-gray-600">Verification Requests</div>
                        </div>
                        <UserCheck className="w-8 h-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold">8</div>
                          <div className="text-sm text-gray-600">Suspended Users</div>
                        </div>
                        <UserX className="w-8 h-8 text-orange-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">Recent Reports</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">Inappropriate content</div>
                        <div className="text-sm text-gray-600">Reported by @user123</div>
                      </div>
                      <Button size="sm" variant="outline">Review</Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">Spam account</div>
                        <div className="text-sm text-gray-600">Reported by @moderator456</div>
                      </div>
                      <Button size="sm" variant="outline">Review</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Moderation Tab */}
        <TabsContent value="moderation">
          <ContentModerationControl />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Platform Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        User Growth
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                        <div className="text-center">
                          <BarChart3 className="w-12 h-12 mx-auto text-gray-400" />
                          <p className="text-gray-500 mt-2">User growth chart would appear here</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <TrendingUp className="w-5 h-5 mr-2" />
                        Revenue Trends
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                        <div className="text-center">
                          <TrendingUp className="w-12 h-12 mx-auto text-gray-400" />
                          <p className="text-gray-500 mt-2">Revenue trends chart would appear here</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold">1,240</div>
                          <div className="text-sm text-gray-600">Daily Active Users</div>
                        </div>
                        <Users className="w-8 h-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold">85%</div>
                          <div className="text-sm text-gray-600">User Retention</div>
                        </div>
                        <Clock className="w-8 h-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold">4.8</div>
                          <div className="text-sm text-gray-600">Avg. Rating</div>
                        </div>
                        <Star className="w-8 h-8 text-yellow-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <SettingsTabContent />
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={selectedUser.avatar_url} />
                  <AvatarFallback>{selectedUser.display_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">{selectedUser.display_name}</h3>
                  <p className="text-gray-600">@{selectedUser.username}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    {selectedUser.is_premium && <Crown className="w-4 h-4 text-purple-500" />}
                    {selectedUser.is_verified && <CheckCircle className="w-4 h-4 text-blue-500" />}
                    {selectedUser.is_banned && <Ban className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold">Account Information</h4>
                  <div className="text-sm text-gray-600 mt-2">
                    <p>Loop Coins: {selectedUser.loop_coins}</p>
                    <p>Joined: {new Date(selectedUser.created_at).toLocaleDateString()}</p>
                    <p>Last Active: {new Date(selectedUser.last_active).toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold">Status</h4>
                  <div className="text-sm text-gray-600 mt-2">
                    <p>Premium: {selectedUser.is_premium ? "Yes" : "No"}</p>
                    <p>Verified: {selectedUser.is_verified ? "Yes" : "No"}</p>
                    <p>Banned: {selectedUser.is_banned ? "Yes" : "No"}</p>
                    {selectedUser.is_banned && selectedUser.banned_until && (
                      <p>Banned Until: {new Date(selectedUser.banned_until).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button onClick={() => handleGiveCoins(selectedUser.id, 100)}>
                  <Coins className="w-4 h-4 mr-2" />
                  Give 100 Coins
                </Button>
                
                {!selectedUser.is_premium && (
                  <Button onClick={() => handleUserAction(selectedUser.id, 'premium')}>
                    <Crown className="w-4 h-4 mr-2" />
                    Make Premium
                  </Button>
                )}
                
                {!selectedUser.is_verified && (
                  <Button onClick={() => handleUserAction(selectedUser.id, 'verify')}>
                    <UserCheck className="w-4 h-4 mr-2" />
                    Verify
                  </Button>
                )}
                
                <Button 
                  variant={selectedUser.is_banned ? "default" : "destructive"}
                  onClick={() => handleUserAction(selectedUser.id, selectedUser.is_banned ? 'unban' : 'ban')}
                >
                  <Ban className="w-4 h-4 mr-2" />
                  {selectedUser.is_banned ? 'Unban' : 'Ban'} User
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
