"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
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
  Moon,
  Sun,
  Camera,
  Save,
  Crown,
  Star,
  Users,
  Monitor,
} from "lucide-react"
import { cn } from "@/lib/utils"

const themeOptions = [
  { id: "light", name: "Light", icon: Sun, description: "Bright surfaces and dark text" },
  { id: "dark", name: "Dark", icon: Moon, description: "Dim surfaces and light text" },
  { id: "system", name: "System", icon: Monitor, description: "Match your device setting" },
]

export function EnhancedSettings() {
  const { user, getAuthHeader, applyServerProfile, refreshUser } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const [formData, setFormData] = useState({
    display_name: "",
    username: "",
    bio: "",
    email: "",
    website: "",
    location: "",
    privacy: {
      profile_visibility: "public",
      show_email: false,
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
    },
  })

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!user) return
    const privacy = (user as any).privacy_settings || {}
    const notifications = (user as any).notification_settings || {}
    setFormData({
      display_name: user.display_name || "",
      username: user.username || "",
      bio: user.bio || "",
      email: user.email || "",
      website: user.website || "",
      location: user.location || "",
      privacy: {
        profile_visibility: privacy.profile_visibility || "public",
        show_email: Boolean(privacy.show_email),
        allow_messages: privacy.allow_messages !== false && privacy.message_privacy !== "none",
        allow_friend_requests: privacy.allow_friend_requests !== false,
      },
      notifications: {
        email_notifications: notifications.email !== false && notifications.email_notifications !== false,
        push_notifications: notifications.push !== false && notifications.push_notifications !== false,
        loop_likes: notifications.loop_likes !== false,
        loop_comments: notifications.loop_comments !== false,
        new_followers: notifications.new_followers !== false,
        mentions: notifications.mentions !== false,
        circle_invites: notifications.circle_invites !== false,
        promotional: Boolean(notifications.promotional),
      },
    })
  }, [user])

  const saveSettings = async () => {
    if (!user) return
    setLoading(true)
    try {
      const response = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          display_name: formData.display_name,
          bio: formData.bio,
          website: formData.website,
          location: formData.location,
          privacy_settings: {
            profile_visibility: formData.privacy.profile_visibility,
            show_email: formData.privacy.show_email,
            message_privacy: formData.privacy.allow_messages ? "everyone" : "none",
            allow_messages: formData.privacy.allow_messages,
            allow_friend_requests: formData.privacy.allow_friend_requests,
          },
          notification_settings: {
            email: formData.notifications.email_notifications,
            push: formData.notifications.push_notifications,
            in_app: true,
            email_notifications: formData.notifications.email_notifications,
            push_notifications: formData.notifications.push_notifications,
            loop_likes: formData.notifications.loop_likes,
            loop_comments: formData.notifications.loop_comments,
            new_followers: formData.notifications.new_followers,
            mentions: formData.notifications.mentions,
            circle_invites: formData.notifications.circle_invites,
            promotional: formData.notifications.promotional,
          },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save")

      if (data.profile) applyServerProfile(data.profile)
      await refreshUser()
      toast({ title: "Settings saved", description: "Your preferences are up to date." })
    } catch (error: any) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("type", "image")
      body.append("folder", "avatars")
      const upload = await fetch("/api/upload", {
        method: "POST",
        headers: { ...getAuthHeader() },
        body,
      })
      const uploaded = await upload.json()
      if (!upload.ok) throw new Error(uploaded.error || "Upload failed")

      const response = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ avatar_url: uploaded.url }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update avatar")
      if (data.profile) applyServerProfile(data.profile)
      toast({ title: "Avatar updated", description: file.type === "image/gif" ? "Animated GIF saved." : undefined })
    } catch (error: any) {
      toast({ title: "Avatar upload failed", description: error.message, variant: "destructive" })
    } finally {
      setUploading(false)
      event.target.value = ""
    }
  }

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return
    setUploadingCover(true)
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("type", "image")
      body.append("folder", "banners")
      const upload = await fetch("/api/upload", {
        method: "POST",
        headers: { ...getAuthHeader() },
        body,
      })
      const uploaded = await upload.json()
      if (!upload.ok) throw new Error(uploaded.error || "Upload failed")

      const response = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ banner_url: uploaded.url }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update cover")
      if (data.profile) applyServerProfile(data.profile)
      toast({ title: "Cover updated", description: file.type === "image/gif" ? "Animated GIF cover saved." : undefined })
    } catch (error: any) {
      toast({ title: "Cover upload failed", description: error.message, variant: "destructive" })
    } finally {
      setUploadingCover(false)
      event.target.value = ""
    }
  }

  const applyAppearance = async (nextTheme: string) => {
    setTheme(nextTheme)
    try {
      const response = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          appearance_mode: nextTheme,
        }),
      })
      const data = await response.json()
      if (response.ok && data.profile) applyServerProfile(data.profile)
    } catch {
      // Theme still applies locally via next-themes
    }
  }

  useEffect(() => {
    if (!mounted || !user) return
    const saved =
      (user.theme_data && typeof user.theme_data === "object"
        ? (user.theme_data as { mode?: string }).mode
        : undefined) ||
      (user.theme_preferences &&
      typeof user.theme_preferences === "object" &&
      !("colors" in (user.theme_preferences as object))
        ? (user.theme_preferences as { mode?: string }).mode
        : undefined)
    if (saved && ["light", "dark", "system"].includes(saved) && theme !== saved) {
      setTheme(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user?.id])

  if (!user) {
    return <p className="text-muted-foreground">Sign in to manage settings.</p>
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1 sm:grid-cols-4">
          <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-background">
            <User className="mr-2 h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-xl data-[state=active]:bg-background">
            <Palette className="mr-2 h-4 w-4" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl data-[state=active]:bg-background">
            <Bell className="mr-2 h-4 w-4" /> Alerts
          </TabsTrigger>
          <TabsTrigger value="privacy" className="rounded-xl data-[state=active]:bg-background">
            <Shield className="mr-2 h-4 w-4" /> Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invite friends</CardTitle>
              <CardDescription>Share Loop with people who should be in your circles.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="rounded-full">
                <Link href="/invite"><Users className="mr-2 h-4 w-4" /> Open invite flow</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>These details appear on your public profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>{formData.display_name.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                    disabled={uploading}
                    onClick={() => document.getElementById("avatar-upload")?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <input id="avatar-upload" type="file" accept="image/*,.gif,image/gif" className="hidden" onChange={handleAvatarUpload} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{formData.display_name || "Your name"}</h3>
                    {user.is_verified && <Badge variant="secondary"><Star className="mr-1 h-3 w-3" />Verified</Badge>}
                    {user.is_premium && <Badge><Crown className="mr-1 h-3 w-3" />Premium</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">@{formData.username}</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, or animated GIF</p>
                  {uploading && <p className="text-xs text-muted-foreground">Uploading avatar…</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Cover photo</Label>
                <div className="relative h-28 overflow-hidden rounded-xl border border-border bg-muted">
                  {user.banner_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.banner_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No cover yet
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute bottom-2 right-2 rounded-full"
                    disabled={uploadingCover}
                    onClick={() => document.getElementById("cover-upload")?.click()}
                  >
                    <Camera className="mr-1.5 h-3.5 w-3.5" />
                    {uploadingCover ? "Uploading…" : "Edit cover"}
                  </Button>
                  <input id="cover-upload" type="file" accept="image/*,.gif,image/gif" className="hidden" onChange={handleCoverUpload} />
                </div>
                <p className="text-xs text-muted-foreground">Supports animated GIFs for cover photos.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, display_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={formData.username} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="City, Country"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  maxLength={500}
                  onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                  className="min-h-[110px]"
                />
                <p className="text-xs text-muted-foreground">{formData.bio.length}/500</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Color theme</CardTitle>
              <CardDescription>
                Light and dark are your main look (white / black). Shop themes add accent colors on top — both keep working together. Current:{" "}
                {mounted ? resolvedTheme || theme : "…"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const active = mounted && theme === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => void applyAppearance(option.id)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        active
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border bg-card hover:bg-muted/50",
                      )}
                    >
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="font-medium">{option.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  )
                })}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Light preview</p>
                  <div className="rounded-xl bg-white p-3 text-slate-900 shadow-sm">
                    <div className="mb-2 h-2 w-1/2 rounded bg-slate-200" />
                    <div className="h-2 w-3/4 rounded bg-slate-100" />
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dark preview</p>
                  <div className="rounded-xl bg-slate-950 p-3 text-slate-100 shadow-sm">
                    <div className="mb-2 h-2 w-1/2 rounded bg-slate-700" />
                    <div className="h-2 w-3/4 rounded bg-slate-800" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose what Loop can notify you about.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  ["email_notifications", "Email notifications"],
                  ["push_notifications", "Push notifications"],
                  ["loop_likes", "Likes on your loops"],
                  ["loop_comments", "Comments"],
                  ["new_followers", "New followers"],
                  ["mentions", "Mentions"],
                  ["circle_invites", "Circle invites"],
                  ["promotional", "Product tips & promos"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
                  <Label htmlFor={key}>{label}</Label>
                  <Switch
                    id={key}
                    checked={formData.notifications[key]}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        notifications: { ...prev.notifications, [key]: checked },
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Privacy</CardTitle>
              <CardDescription>Control who can see and contact you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Profile visibility</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["public", "private"].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={formData.privacy.profile_visibility === value ? "default" : "outline"}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          privacy: { ...prev.privacy, profile_visibility: value },
                        }))
                      }
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              {(
                [
                  ["show_email", "Show email on profile"],
                  ["allow_messages", "Allow direct messages"],
                  ["allow_friend_requests", "Allow follow requests / connects"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
                  <Label htmlFor={key}>{label}</Label>
                  <Switch
                    id={key}
                    checked={formData.privacy[key]}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        privacy: { ...prev.privacy, [key]: checked },
                      }))
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="sticky bottom-20 z-20 flex justify-end gap-2 rounded-2xl border border-border bg-background/90 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <Button onClick={saveSettings} disabled={loading} className="rounded-full px-6">
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  )
}
