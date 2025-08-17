"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Trash2, 
  Moon, 
  Sun, 
  Upload, 
  Crown, 
  Mail, 
  Lock,
  DollarSign,
  CreditCard,
  Settings,
  Camera,
  Image as ImageIcon
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "next-themes"

interface ProfileData {
  display_name: string
  username: string
  bio: string
  email: string
  location: string
  website: string
  avatar_url?: string
  banner_url?: string
}

interface NotificationSettings {
  email_loops: boolean
  email_branches: boolean
  email_messages: boolean
  email_streams: boolean
  push_loops: boolean
  push_branches: boolean
  push_messages: boolean
  push_streams: boolean
  marketing: boolean
}

interface PrivacySettings {
  profile_visibility: string
  show_activity: boolean
  allow_messages: boolean
  show_online_status: boolean
  allow_stream_notifications: boolean
}

export function EnhancedSettings() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  const [profileData, setProfileData] = useState<ProfileData>({
    display_name: user?.user_metadata?.display_name || "",
    username: user?.user_metadata?.username || "",
    bio: user?.user_metadata?.bio || "",
    email: user?.email || "",
    location: user?.user_metadata?.location || "",
    website: user?.user_metadata?.website || "",
    avatar_url: user?.user_metadata?.avatar_url,
    banner_url: user?.user_metadata?.banner_url
  })

  const [notifications, setNotifications] = useState<NotificationSettings>({
    email_loops: true,
    email_branches: true,
    email_messages: true,
    email_streams: true,
    push_loops: true,
    push_branches: true,
    push_messages: true,
    push_streams: true,
    marketing: false,
  })

  const [privacy, setPrivacy] = useState<PrivacySettings>({
    profile_visibility: "public",
    show_activity: true,
    allow_messages: true,
    show_online_status: true,
    allow_stream_notifications: true,
  })

  const [uploading, setUploading] = useState<{ avatar: boolean; banner: boolean }>({
    avatar: false,
    banner: false
  })

  const [earnings, setEarnings] = useState({
    total: 0,
    available: 0,
    pending: 0
  })

  const handleFileUpload = async (file: File, type: 'avatar' | 'banner') => {
    if (!file) return

    setUploading(prev => ({ ...prev, [type]: true }))

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      
      setProfileData(prev => ({
        ...prev,
        [`${type}_url`]: result.data.url
      }))

      toast({
        title: "Upload Successful",
        description: `${type === 'avatar' ? 'Profile picture' : 'Banner'} updated successfully.`,
      })

    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  const handleProfileUpdate = async () => {
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify(profileData)
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleNotificationUpdate = async () => {
    try {
      const response = await fetch('/api/users/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify(notifications)
      })

      if (!response.ok) {
        throw new Error('Failed to update notifications')
      }

      toast({
        description: "Notification preferences updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update notifications.",
        variant: "destructive",
      })
    }
  }

  const handlePrivacyUpdate = async () => {
    try {
      const response = await fetch('/api/users/privacy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.access_token}`
        },
        body: JSON.stringify(privacy)
      })

      if (!response.ok) {
        throw new Error('Failed to update privacy settings')
      }

      toast({
        description: "Privacy settings updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update privacy settings.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-gray-400 mt-2">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8">
          <TabsTrigger value="profile" className="flex items-center space-x-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Privacy</span>
          </TabsTrigger>
          <TabsTrigger value="earnings" className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4" />
            <span className="hidden sm:inline">Earnings</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center space-x-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          {/* Banner Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Banner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div 
                  className="w-full h-32 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => bannerInputRef.current?.click()}
                >
                  {profileData.banner_url ? (
                    <img 
                      src={profileData.banner_url} 
                      alt="Profile banner" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-white">
                        <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-70" />
                        <p className="text-sm opacity-70">Click to upload banner</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file, 'banner')
                  }}
                />
                {uploading.banner && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p className="text-sm">Uploading...</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profile Picture & Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <Avatar className="w-24 h-24 cursor-pointer group" onClick={() => avatarInputRef.current?.click()}>
                    <AvatarImage src={profileData.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="text-2xl">{profileData.display_name?.charAt(0) || "U"}</AvatarFallback>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </Avatar>
                  {uploading.avatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file, 'avatar')
                    }}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{profileData.display_name || "Your Name"}</h3>
                  <p className="text-gray-400">@{profileData.username || "username"}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    {user?.user_metadata?.is_verified && (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        ⭐ Verified
                      </Badge>
                    )}
                    {user?.user_metadata?.is_premium && (
                      <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    value={profileData.display_name}
                    onChange={(e) => setProfileData({ ...profileData, display_name: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  className="mt-2"
                  rows={3}
                />
                <p className="text-sm text-gray-500 mt-1">{profileData.bio.length}/500 characters</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="City, Country"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    placeholder="https://yourwebsite.com"
                    value={profileData.website}
                    onChange={(e) => setProfileData({ ...profileData, website: e.target.value })}
                    className="mt-2"
                  />
                </div>
              </div>

              <Button onClick={handleProfileUpdate} className="bg-gradient-to-r from-purple-500 to-blue-500">
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <span>Email Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'email_loops', label: 'New Loops', desc: 'Get notified when people you follow create new loops' },
                { key: 'email_branches', label: 'Branches', desc: 'When someone branches your loops' },
                { key: 'email_messages', label: 'Messages', desc: 'Direct messages and mentions' },
                { key: 'email_streams', label: 'Live Streams', desc: 'When people you follow go live' },
                { key: 'marketing', label: 'Marketing', desc: 'Product updates and promotional content' }
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <Switch
                    checked={notifications[key as keyof NotificationSettings]}
                    onCheckedChange={(checked) => {
                      setNotifications({ ...notifications, [key]: checked })
                      handleNotificationUpdate()
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Push Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'push_loops', label: 'New Loops', desc: 'Push notifications for new loops' },
                { key: 'push_branches', label: 'Branches', desc: 'When someone branches your loops' },
                { key: 'push_messages', label: 'Messages', desc: 'Direct messages and mentions' },
                { key: 'push_streams', label: 'Live Streams', desc: 'When people you follow go live' }
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <Switch
                    checked={notifications[key as keyof NotificationSettings]}
                    onCheckedChange={(checked) => {
                      setNotifications({ ...notifications, [key]: checked })
                      handleNotificationUpdate()
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Profile Visibility</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Who can see your profile</p>
                </div>
                <select
                  value={privacy.profile_visibility}
                  onChange={(e) => {
                    setPrivacy({ ...privacy, profile_visibility: e.target.value })
                    handlePrivacyUpdate()
                  }}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers Only</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {[
                { key: 'show_activity', label: 'Show Activity', desc: 'Let others see when you\'re active' },
                { key: 'allow_messages', label: 'Allow Messages', desc: 'Who can send you direct messages' },
                { key: 'show_online_status', label: 'Online Status', desc: 'Show when you\'re online' },
                { key: 'allow_stream_notifications', label: 'Stream Notifications', desc: 'Allow notifications when you go live' }
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <Switch
                    checked={privacy[key as keyof PrivacySettings]}
                    onCheckedChange={(checked) => {
                      setPrivacy({ ...privacy, [key]: checked })
                      handlePrivacyUpdate()
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lock className="w-5 h-5" />
                <span>Account Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Update your account password</p>
                </div>
                <Button variant="outline" size="sm">
                  Change Password
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Add an extra layer of security</p>
                </div>
                <Button variant="outline" size="sm">
                  Enable 2FA
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium">Total Earnings</span>
                </div>
                <p className="text-2xl font-bold mt-2">${earnings.total.toFixed(2)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                  <span className="text-sm font-medium">Available</span>
                </div>
                <p className="text-2xl font-bold mt-2">${earnings.available.toFixed(2)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium">Pending</span>
                </div>
                <p className="text-2xl font-bold mt-2">${earnings.pending.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Withdrawal Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Minimum Withdrawal</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">$10.00 USD</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={earnings.available < 10}
                >
                  Request Withdrawal
                </Button>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Payment Methods</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">PayPal</span>
                    <Button variant="ghost" size="sm">Configure</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Bank Transfer</span>
                    <Button variant="ghost" size="sm">Configure</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'light', label: 'Light', icon: Sun },
                  { value: 'dark', label: 'Dark', icon: Moon },
                  { value: 'system', label: 'System', icon: Settings }
                ].map(({ value, label, icon: Icon }) => (
                  <div
                    key={value}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      theme === value
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                    onClick={() => setTheme(value)}
                  >
                    <Icon className="w-6 h-6 mx-auto mb-2" />
                    <p className="text-sm font-medium text-center">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
