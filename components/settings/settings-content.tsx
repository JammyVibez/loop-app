// @ts-nocheck
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import { User, Bell, Shield, Palette, Trash2, Moon, Sun, Upload, Crown, Mail, Lock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useTheme } from "next-themes"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export function SettingsContent() {
  const { user, getAuthHeader, refreshUser, applyServerProfile } = useAuth()
  const { theme, setTheme, isDark } = useTheme()
  const { toast } = useToast()
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deletionScheduled, setDeletionScheduled] = useState(false)
  const [deletionExecuteAfter, setDeletionExecuteAfter] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const [profileData, setProfileData] = useState({
    display_name: user?.display_name || "",
    username: user?.username || "",
    bio: user?.bio || "",
    email: user?.email || "",
    location: user?.location || "",
    website: user?.website || "",
    avatar_url: user?.avatar_url || "",
    banner_url: user?.banner_url || "",
  })

  useEffect(() => {
    if (!user) return
    setProfileData((prev) => ({
      display_name: user.display_name || prev.display_name || "",
      username: user.username || prev.username || "",
      bio: user.bio || prev.bio || "",
      email: user.email || prev.email || "",
      location: user.location || prev.location || "",
      website: user.website || prev.website || "",
      avatar_url: user.avatar_url || prev.avatar_url || "",
      banner_url: user.banner_url || prev.banner_url || "",
    }))
  }, [user?.id, user?.avatar_url, user?.banner_url, user?.display_name, user?.bio])
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!user) {
      toast({ title: "Sign in required", description: "Log in again to upload a photo.", variant: "destructive" })
      return
    }

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "image")
      formData.append("folder", "avatars")

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          ...getAuthHeader(),
        },
        body: formData,
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload failed")
      }

      const uploadedUrl = result.url || result.data?.url
      if (!uploadedUrl) throw new Error("Upload succeeded but no URL returned")

      const saveRes = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ avatar_url: uploadedUrl }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save avatar")

      setProfileData((prev) => ({ ...prev, avatar_url: uploadedUrl }))
      applyServerProfile?.(saveData.profile || { avatar_url: uploadedUrl })
      await refreshUser?.()
      toast({
        title: "Avatar updated",
        description: "Your profile photo is live.",
      })
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload avatar.",
        variant: "destructive",
      })
    } finally {
      setUploadingAvatar(false)
      event.target.value = ""
    }
  }

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!user) {
      toast({ title: "Sign in required", description: "Log in again to upload a cover.", variant: "destructive" })
      return
    }

    setUploadingBanner(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "image")
      formData.append("folder", "banners")

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          ...getAuthHeader(),
        },
        body: formData,
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload failed")
      }

      const uploadedUrl = result.url || result.data?.url
      if (!uploadedUrl) throw new Error("Upload succeeded but no URL returned")

      const saveRes = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ banner_url: uploadedUrl }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || "Failed to save cover")

      setProfileData((prev) => ({ ...prev, banner_url: uploadedUrl }))
      applyServerProfile?.(saveData.profile || { banner_url: uploadedUrl })
      await refreshUser?.()
      toast({
        title: "Cover photo updated",
        description: "Your profile cover is live.",
      })
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload banner.",
        variant: "destructive",
      })
    } finally {
      setUploadingBanner(false)
      event.target.value = ""
    }
  }

  const handleProfileUpdate = async () => {
    try {
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(profileData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update profile")
      applyServerProfile?.(data.profile || profileData)
      await refreshUser?.()
      toast({
        title: "Profile saved",
        description: "Your settings were updated.",
      })
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      })
    }
  }

  const handleNotificationUpdate = async (next = notifications) => {
    try {
      const notification_settings = {
        ...((user as any)?.notification_settings || {}),
        email_loops: next.email_loops,
        email_branches: next.email_branches,
        email_messages: next.email_messages,
        marketing: next.marketing,
        push_loops: next.push_loops,
        push_branches: next.push_branches,
        push_messages: next.push_messages,
        // Align with push preference keys used by lib/web-push.ts
        push: next.push_loops || next.push_branches || next.push_messages,
        push_notifications: next.push_loops || next.push_branches || next.push_messages,
        social: next.push_loops || next.push_branches,
        directMessages: next.push_messages,
        messages: next.push_messages,
      }
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ notification_settings }),
      })
      if (!res.ok) throw new Error("Failed to save notification preferences")
      applyServerProfile?.({ notification_settings })
      await refreshUser?.()
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

  // Check deletion status on mount
  useEffect(() => {
    if (!user) return
    fetch("/api/users/delete-account", { headers: { ...getAuthHeader() } })
      .then(r => r.json())
      .then(data => {
        if (data.scheduled) {
          setDeletionScheduled(true)
          setDeletionExecuteAfter(data.execute_after)
        }
      })
      .catch(() => {})
  }, [user])

  const handleDeleteAccount = () => {
    setDeleteDialogOpen(true)
    setDeleteConfirmText("")
  }

  const confirmDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return
    setDeleting(true)
    try {
      const res = await fetch("/api/users/delete-account", {
        method: "POST",
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to schedule deletion")
      setDeletionScheduled(true)
      setDeletionExecuteAfter(data.execute_after)
      setDeleteDialogOpen(false)
      toast({
        title: "Account deletion scheduled",
        description: "Your account will be deleted in 3 days. You can cancel anytime before then.",
        variant: "destructive",
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeletion = async () => {
    setCancelling(true)
    try {
      const res = await fetch("/api/users/delete-account", {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to cancel")
      setDeletionScheduled(false)
      setDeletionExecuteAfter(null)
      toast({ title: "Deletion cancelled", description: "Your account is safe." })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setCancelling(false)
    }
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
                  <AvatarImage src={profileData.avatar_url || user?.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback className="text-2xl">{user?.display_name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="flex items-center space-x-2"
                    disabled={uploadingAvatar}
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadingAvatar ? "Uploading…" : "Upload New Picture"}</span>
                  </Button>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user?.is_premium
                      ? "Premium users can upload GIFs and videos up to 10s"
                      : "Upgrade to Premium for animated avatars"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Banner */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Banner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="w-full h-32 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg overflow-hidden">
                  {profileData.banner_url ? (
                    <ProxyImg src={profileData.banner_url} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                      <span>No banner uploaded</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Button variant="outline" className="flex items-center space-x-2" onClick={() => document.getElementById('banner-upload')?.click()}>
                    <Upload className="w-4 h-4" />
                    <span>Upload Banner</span>
                  </Button>
                  <input
                    id="banner-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerUpload}
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Recommended size: 1500x500 pixels
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

          <Card className="border-red-500/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
                <span>Danger Zone</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Permanently delete your account and all data. You have 3 days to cancel.
                  </p>
                </div>
                {deletionScheduled ? (
                  <div className="space-y-2">
                    <Badge variant="destructive" className="text-xs">
                      Deletion scheduled for {deletionExecuteAfter ? new Date(deletionExecuteAfter).toLocaleDateString() : "soon"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={cancelDeletion} disabled={cancelling} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                      {cancelling ? "Cancelling..." : "Cancel Deletion"}
                    </Button>
                  </div>
                ) : (
                  <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                )}
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
                    const next = { ...notifications, email_loops: checked }
                    setNotifications(next)
                    handleNotificationUpdate(next)
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
                    const next = { ...notifications, email_branches: checked }
                    setNotifications(next)
                    handleNotificationUpdate(next)
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
                    const next = { ...notifications, email_messages: checked }
                    setNotifications(next)
                    handleNotificationUpdate(next)
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
                    const next = { ...notifications, marketing: checked }
                    setNotifications(next)
                    handleNotificationUpdate(next)
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
                    const next = { ...notifications, push_loops: checked }
                    setNotifications(next)
                    handleNotificationUpdate(next)
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
                    const next = { ...notifications, push_branches: checked }
                    setNotifications(next)
                    handleNotificationUpdate(next)
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
                    const next = { ...notifications, push_messages: checked }
                    setNotifications(next)
                    handleNotificationUpdate(next)
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

        </div>
      </TabsContent>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md bg-card border-rose-500/30">
          <DialogHeader>
            <DialogTitle className="text-rose-400">Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Your account will be deactivated immediately and permanently deleted after 3 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-300">
              <p className="font-semibold mb-1">What happens:</p>
              <ul className="list-disc list-inside space-y-1 text-xs text-rose-300/80">
                <li>Your profile becomes inaccessible immediately</li>
                <li>Your posts remain visible but show &quot;Deleted Account&quot;</li>
                <li>You cannot log in for 3 days (grace period)</li>
                <li>After 3 days, all data is permanently deleted</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Type DELETE to confirm</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="border-rose-500/30 focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleting}
              >
                {deleting ? "Scheduling..." : "Delete Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}