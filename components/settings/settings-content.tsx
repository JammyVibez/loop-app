"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User, Bell, Shield, Palette, Trash2, Moon, Sun, Upload, Crown, Mail, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "next-themes"

export function SettingsContent() {
  const { user } = useAuth()
  const { theme, setTheme, isDark } = useTheme()
  const { toast } = useToast()

  const [profileData, setProfileData] = useState({
    display_name: user?.display_name || "",
    username: user?.username || "",
    bio: user?.bio || "",
    email: user?.email || "",
    location: "",
    website: "",
  })
  const [notifications, setNotifications] = useState({
    email_loops: true,
    email_branches: true,
    email_messages: true,
    push_loops: true,
    push_branches: true,
    push_messages: true,
    marketing: false,
  })
  const [privacy, setPrivacy] = useState({
    profile_visibility: "public",
    show_activity: true,
    allow_messages: true,
    show_online_status: true,
  })

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
      await new Promise((resolve) => setTimeout(resolve, 500))
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

  const handleThemeToggle = () => {
    const newTheme = isDark ? "light" : "dark"
    setTheme(newTheme)
    toast({
      description: `Switched to ${newTheme} mode`,
    })
  }

  const handleDeleteAccount = () => {
    // This would show a confirmation dialog in a real app
    toast({
      title: "Account Deletion",
      description: "This action would require additional confirmation.",
      variant: "destructive",
    })
  }

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
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
        <TabsTrigger value="appearance" className="flex items-center space-x-2">
          <Palette className="w-4 h-4" />
          <span className="hidden sm:inline">Appearance</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-6">
        <div className="space-y-6">
          {/* Profile Picture */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="text-2xl">{user?.display_name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" className="flex items-center space-x-2">
                    <Upload className="w-4 h-4" />
                    <span>Upload New Picture</span>
                  </Button>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user?.is_premium
                      ? "Premium users can upload GIFs and videos up to 10s"
                      : "Upgrade to Premium for animated avatars"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                />
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

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span>Verification Status:</span>
                    {user?.is_verified ? (
                      <Badge
                        className={
                          user.verification_level === "root"
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        }
                      >
                        {user.verification_level === "root" ? "🌱 Root Verified" : "⭐ Influencer Verified"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not Verified</Badge>
                    )}
                  </div>
                </div>
                {!user?.is_verified && (
                  <Button variant="outline" size="sm">
                    Apply for Verification
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Crown className="w-5 h-5 text-purple-600" />
                  <span>Premium Status:</span>
                  {user?.is_premium ? (
                    <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">Premium Active</Badge>
                  ) : (
                    <Badge variant="outline">Free Account</Badge>
                  )}
                </div>
                <Button variant="outline" size="sm">
                  {user?.is_premium ? "Manage Subscription" : "Upgrade to Premium"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="notifications" className="mt-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <span>Email Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">New Loops</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Get notified when people you follow create new loops
                  </p>
                </div>
                <Switch
                  checked={notifications.email_loops}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, email_loops: checked })
                    handleNotificationUpdate()
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Branches</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">When someone branches your loops</p>
                </div>
                <Switch
                  checked={notifications.email_branches}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, email_branches: checked })
                    handleNotificationUpdate()
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Messages</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Direct messages and mentions</p>
                </div>
                <Switch
                  checked={notifications.email_messages}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, email_messages: checked })
                    handleNotificationUpdate()
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Marketing</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Product updates and promotional content</p>
                </div>
                <Switch
                  checked={notifications.marketing}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, marketing: checked })
                    handleNotificationUpdate()
                  }}
                />
              </div>
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">New Loops</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Push notifications for new loops</p>
                </div>
                <Switch
                  checked={notifications.push_loops}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, push_loops: checked })
                    handleNotificationUpdate()
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Branches</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">When someone branches your loops</p>
                </div>
                <Switch
                  checked={notifications.push_branches}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, push_branches: checked })
                    handleNotificationUpdate()
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Messages</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Direct messages and mentions</p>
                </div>
                <Switch
                  checked={notifications.push_messages}
                  onCheckedChange={(checked) => {
                    setNotifications({ ...notifications, push_messages: checked })
                    handleNotificationUpdate()
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="privacy" className="mt-6">
        <div className="space-y-6">
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
                  onChange={(e) => setPrivacy({ ...privacy, profile_visibility: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers Only</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Show Activity</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Let others see when you're active</p>
                </div>
                <Switch
                  checked={privacy.show_activity}
                  onCheckedChange={(checked) => setPrivacy({ ...privacy, show_activity: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allow Messages</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Who can send you direct messages</p>
                </div>
                <Switch
                  checked={privacy.allow_messages}
                  onCheckedChange={(checked) => setPrivacy({ ...privacy, allow_messages: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Online Status</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Show when you're online</p>
                </div>
                <Switch
                  checked={privacy.show_online_status}
                  onCheckedChange={(checked) => setPrivacy({ ...privacy, show_online_status: checked })}
                />
              </div>
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

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Login Sessions</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage your active sessions</p>
                </div>
                <Button variant="outline" size="sm">
                  View Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="appearance" className="mt-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark themes</p>
                  </div>
                </div>
                <Switch checked={isDark} onCheckedChange={handleThemeToggle} />
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    theme === "light"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  onClick={() => setTheme("light")}
                >
                  <div className="w-full h-20 bg-white rounded border mb-2"></div>
                  <p className="text-sm font-medium text-center">Light</p>
                </div>

                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    theme === "dark"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  onClick={() => setTheme("dark")}
                >
                  <div className="w-full h-20 bg-gray-900 rounded border mb-2"></div>
                  <p className="text-sm font-medium text-center">Dark</p>
                </div>

                <div
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    theme === "system"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                  onClick={() => setTheme("system")}
                >
                  <div className="w-full h-20 bg-gradient-to-r from-white to-gray-900 rounded border mb-2"></div>
                  <p className="text-sm font-medium text-center">System</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Customization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Profile Theme</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Customize your profile colors and animations
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Customize Theme
                </Button>
              </div>

              {!user?.is_premium && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <Crown className="w-6 h-6 text-purple-600" />
                    <div>
                      <p className="font-medium text-purple-800 dark:text-purple-300">Unlock Premium Themes</p>
                      <p className="text-sm text-purple-600 dark:text-purple-400">
                        Upgrade to Premium for exclusive themes, animations, and customization options
                      </p>
                    </div>
                  </div>
                  <Button className="mt-3 bg-gradient-to-r from-purple-500 to-blue-500" size="sm">
                    Upgrade to Premium
                  </Button>
                </div>
              )}
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
                <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}
