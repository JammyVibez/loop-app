
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Globe, 
  Smartphone,
  Moon,
  Sun,
  Eye,
  EyeOff,
  Camera,
  Save,
  RefreshCw,
  Crown,
  Star,
  Trash2
} from "lucide-react"
import { useTheme } from "next-themes"
import { ProfileThemeCustomizer } from "@/components/profile/profile-theme-customizer"

const themes = [
  { id: "light", name: "Light", icon: Sun },
  { id: "dark", name: "Dark", icon: Moon },
  { id: "system", name: "System", icon: Smartphone },
]

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
]

export function EnhancedSettings() {
  const { user, updateProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false)
  const [formData, setFormData] = useState({
    display_name: user?.display_name || "",
    username: user?.username || "",
    bio: user?.bio || "",
    email: user?.email || "",
    phone: user?.phone || "",
    website: user?.website || "",
    location: user?.location || "",
    language: "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    privacy: {
      profile_visibility: "public",
      show_email: false,
      show_phone: false,
      allow_messages: true,
      allow_friend_requests: true,
    },
    notifications: {
      email_notifications: true,
      push_notifications: true,
      loop_likes: true,
      loop_comments: true,
      new_followers: true,
      mentions: true,
      circle_invites: true,
      promotional: false,
    }
  })

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateProfile({
        display_name: formData.display_name,
        bio: formData.bio,
        website: formData.website,
        location: formData.location,
        // Add other fields as needed
      })
      
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Add avatar upload logic here
    toast({
      title: "Feature coming soon",
      description: "Avatar upload will be available soon.",
    })
  }

  const handleDeleteAccount = () => {
    toast({
      title: "Feature coming soon",
      description: "Account deletion will be available soon.",
      variant: "destructive",
    })
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Privacy
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile details and personal information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="text-2xl">
                      {formData.display_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    className="absolute -bottom-2 -right-2 rounded-full w-8 h-8"
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{formData.display_name}</h3>
                    {user?.is_verified && (
                      <Badge variant="secondary" className="text-blue-600">
                        <Star className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    {user?.is_premium && (
                      <Badge className="bg-gradient-to-r from-purple-600 to-blue-600">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">@{formData.username}</p>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    disabled
                  />
                  <p className="text-xs text-gray-500">Username cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={formData.language} onValueChange={(value) => setFormData(prev => ({ ...prev, language: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  className="min-h-[100px]"
                />
                <p className="text-xs text-gray-500">{formData.bio.length}/500 characters</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme & Appearance</CardTitle>
              <CardDescription>
                Customize how Loop looks and feels for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Color Theme</Label>
                <div className="grid grid-cols-3 gap-4">
                  {themes.map((themeOption) => {
                    const Icon = themeOption.icon
                    return (
                      <Button
                        key={themeOption.id}
                        variant={theme === themeOption.id ? "default" : "outline"}
                        onClick={() => setTheme(themeOption.id)}
                        className="flex items-center gap-2 h-12"
                      >
                        <Icon className="w-4 h-4" />
                        {themeOption.name}
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Profile Theme Customization</Label>
                    <p className="text-sm text-gray-500">
                      Customize your profile colors and animations
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowThemeCustomizer(true)}
                  >
                    <Palette className="w-4 h-4 mr-2" />
                    Customize
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose what notifications you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {Object.entries(formData.notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <Label className="capitalize">
                        {key.replace(/_/g, ' ')}
                      </Label>
                    </div>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({
                          ...prev,
                          notifications: { ...prev.notifications, [key]: checked }
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>
                Control who can see your content and contact you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Profile Visibility</Label>
                  <Select
                    value={formData.privacy.profile_visibility}
                    onValueChange={(value) =>
                      setFormData(prev => ({
                        ...prev,
                        privacy: { ...prev.privacy, profile_visibility: value }
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="followers">Followers Only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {Object.entries(formData.privacy)
                  .filter(([key]) => key !== 'profile_visibility')
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <Label className="capitalize">
                          {key.replace(/_/g, ' ')}
                        </Label>
                      </div>
                      <Switch
                        checked={value as boolean}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({
                            ...prev,
                            privacy: { ...prev.privacy, [key]: checked }
                          }))
                        }
                      />
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Advanced account settings and data management.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Export Account Data
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  <Eye className="w-4 h-4 mr-2" />
                  Download Data Archive
                </Button>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium text-red-600 mb-2">Danger Zone</h4>
                  <Button
                    variant="destructive"
                    className="w-full justify-start"
                    onClick={handleDeleteAccount}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    This action cannot be undone. All your data will be permanently deleted.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <ProfileThemeCustomizer
        open={showThemeCustomizer}
        onOpenChange={setShowThemeCustomizer}
        currentTheme={user?.profile_theme}
        onThemeUpdate={(theme) => {
          // Handle theme update
          toast({
            title: "Theme updated",
            description: "Your profile theme has been updated.",
          })
        }}
      />
    </div>
  )
}
