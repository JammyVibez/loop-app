"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
import { PRO_PRICING } from "@/lib/pro-features"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { ensureServiceWorker, subscribeToPush, subscriptionToJSON, unsubscribeFromPush } from "@/lib/push-client"
import {
  MAX_BIO_COMMUNITY_TAGS,
  serializeCircleBioToken,
  type TaggedCircle,
} from "@/lib/circle-limits"
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
  X,
  Building2,
  Gift,
} from "lucide-react"
import { OrganizationSettings } from "@/components/settings/organization-settings"
import { ReferralsSettings } from "@/components/settings/referrals-settings"
import { SecuritySettings } from "@/components/settings/security-settings"
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
  const searchParams = useSearchParams()
  const requestedTab = searchParams?.get("tab") || "profile"
  const [tab, setTab] = useState(requestedTab)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default")

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
      message_privacy: "everyone" as "everyone" | "followers" | "nobody",
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
  const [taggedCircles, setTaggedCircles] = useState<TaggedCircle[]>([])
  const [joinedCircles, setJoinedCircles] = useState<TaggedCircle[]>([])
  const [loadingCircles, setLoadingCircles] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window === "undefined") return
    const isIosSafariTab =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !(window.navigator as any).standalone &&
      !window.matchMedia("(display-mode: standalone)").matches
    if (!("Notification" in window) || !("PushManager" in window) || isIosSafariTab) {
      setPushPermission("unsupported")
    } else {
      setPushPermission(Notification.permission)
    }
  }, [])

  // Toggling this switch used to only flip a preference flag in
  // notification_settings — it never actually called the browser Push API,
  // so users who enabled it here (the most discoverable place to do so)
  // never got a real subscription and push silently never fired. This now
  // drives the real subscribe/unsubscribe flow, same as the Notifications
  // page's push manager.
  const handleTogglePush = async (checked: boolean) => {
    if (pushPermission === "unsupported") {
      toast({
        title: "Push isn't supported here",
        description: /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? "On iPhone/iPad, add Loop to your Home Screen first (Share → Add to Home Screen), then enable push from there."
          : "This browser doesn't support Web Push notifications.",
        variant: "destructive",
      })
      return
    }

    setPushBusy(true)
    try {
      if (checked) {
        await ensureServiceWorker()
        const subscription = await subscribeToPush()
        if (!subscription) throw new Error("Browser did not return a push subscription")
        const payload = subscriptionToJSON(subscription)
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to save subscription")
        setPushPermission("granted")
        toast({ title: "Push notifications enabled", description: "You'll get alerts even when Loop is in the background." })
      } else {
        const endpoint = await unsubscribeFromPush()
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify(endpoint ? { endpoint } : {}),
        })
        toast({ title: "Push notifications disabled" })
      }
      setFormData((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, push_notifications: checked },
      }))
    } catch (err: any) {
      setPushPermission(typeof Notification !== "undefined" ? Notification.permission : "default")
      toast({
        title: "Push setup failed",
        description: err.message || "Could not update push notifications.",
        variant: "destructive",
      })
    } finally {
      setPushBusy(false)
    }
  }

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
        allow_messages: privacy.allow_messages !== false && privacy.message_privacy !== "none" && privacy.message_privacy !== "nobody",
        message_privacy:
          privacy.message_privacy === "followers" || privacy.message_privacy === "nobody"
            ? privacy.message_privacy
            : privacy.message_privacy === "none"
              ? "nobody"
              : "everyone",
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
    const existingTags = Array.isArray((user as any).tagged_circles) ? (user as any).tagged_circles : []
    setTaggedCircles(
      existingTags
        .filter((t: any) => t?.id && t?.name)
        .map((t: any) => ({ id: t.id, name: t.name, avatar_url: t.avatar_url || null })),
    )
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoadingCircles(true)
      try {
        const res = await fetch("/api/circles?joined=true", { headers: { ...getAuthHeader() } })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) return
        const mine = (data.circles || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          avatar_url: c.avatar_url || null,
        }))
        setJoinedCircles(mine)
      } catch {
        if (!cancelled) setJoinedCircles([])
      } finally {
        if (!cancelled) setLoadingCircles(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Real-time save for switches (Alerts + Privacy tabs): toggling a switch
  // applies immediately instead of waiting for the Save button.
  const quickSave = async (patch: Record<string, unknown>) => {
    if (!user) return
    try {
      const response = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to save")
      if (data.profile) applyServerProfile(data.profile)
      return true
    } catch (error: any) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
      return false
    }
  }

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
          username: formData.username,
          display_name: formData.display_name,
          bio: formData.bio,
          website: formData.website,
          location: formData.location,
          tagged_circles: taggedCircles,
          privacy_settings: {
            profile_visibility: formData.privacy.profile_visibility,
            show_email: formData.privacy.show_email,
            message_privacy: formData.privacy.message_privacy,
            allow_messages: formData.privacy.message_privacy !== "nobody",
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
      if (Array.isArray(data.profile?.tagged_circles)) {
        setTaggedCircles(data.profile.tagged_circles)
      }

      if (data.profile) applyServerProfile(data.profile)
      await refreshUser()
      toast({ title: "Settings saved", description: "Your preferences are up to date." })
      // If username changed, redirect to the new profile URL so links stay valid
      if (formData.username && formData.username !== user.username && data.profile?.username) {
        window.location.href = `/profile/${data.profile.username}`
      }
    } catch (error: any) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return
    // Animated GIF avatars are a Pro-only perk — friendly guard before upload.
    if (file.type === "image/gif" && !user.is_premium) {
      toast({
        title: "GIF avatars are Pro-only",
        description: "Upgrade to Pro to use an animated profile picture. Static images work for everyone.",
        variant: "destructive",
      })
      event.target.value = ""
      return
    }
    setUploading(true)
    try {
      // Phone camera photos routinely exceed Vercel's ~4.5MB request body
      // limit for the Next.js API proxy; uploadMediaFile automatically
      // routes anything over that straight to Cloudinary instead.
      const uploaded = await uploadMediaFile(file, {
        type: "image",
        folder: "avatars",
        authHeaders: getAuthHeader(),
      })

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
    // Animated GIF covers are a Pro-only perk — friendly guard before upload.
    if (file.type === "image/gif" && !user.is_premium) {
      toast({
        title: "GIF covers are Pro-only",
        description: "Upgrade to Pro to use an animated cover photo. Static images work for everyone.",
        variant: "destructive",
      })
      event.target.value = ""
      return
    }
    setUploadingCover(true)
    try {
      const uploaded = await uploadMediaFile(file, {
        type: "image",
        folder: "banners",
        authHeaders: getAuthHeader(),
      })

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
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1 sm:grid-cols-6">
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
          <TabsTrigger value="organization" className="rounded-xl data-[state=active]:bg-background">
            <Building2 className="mr-2 h-4 w-4" /> Organization
          </TabsTrigger>
          <TabsTrigger value="referrals" className="rounded-xl data-[state=active]:bg-background">
            <Gift className="mr-2 h-4 w-4" /> Referrals
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-xl data-[state=active]:bg-background">
            <Shield className="mr-2 h-4 w-4" /> Security
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
                    {!user.is_premium && (
                      <Link href="/premium">
                        <Badge variant="outline" className="cursor-pointer border-amber-500/40 text-amber-600 hover:bg-amber-500/10">
                          <Crown className="mr-1 h-3 w-3" /> Get Pro · {PRO_PRICING.monthly.priceLabel}
                        </Badge>
                      </Link>
                    )}
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
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                      setFormData((prev) => ({ ...prev, username: val }))
                    }}
                    placeholder="lowercase, letters, numbers, underscores"
                  />
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

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="inline-flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      Tag communities in your bio
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Others can tap a tag to open that community. Up to {MAX_BIO_COMMUNITY_TAGS}.
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {taggedCircles.length}/{MAX_BIO_COMMUNITY_TAGS}
                  </Badge>
                </div>

                {taggedCircles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {taggedCircles.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="gap-1.5 py-1.5 pl-2 pr-1">
                        <span className="max-w-[140px] truncate">{tag.name}</span>
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                          onClick={() => {
                            setTaggedCircles((prev) => prev.filter((t) => t.id !== tag.id))
                            setFormData((prev) => ({
                              ...prev,
                              bio: prev.bio.replace(new RegExp(`\\[\\[c:${tag.id}(?:\\|[^\\\]]+)?\\]\\]`, "gi"), "").replace(/\s+/g, " ").trim()
                            }))
                          }}
                          aria-label={`Remove ${tag.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {loadingCircles ? (
                    <p className="text-xs text-muted-foreground">Loading your communities…</p>
                  ) : joinedCircles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Join or create a community first, then tag it here.
                    </p>
                  ) : (
                    joinedCircles
                      .filter((c) => !taggedCircles.some((t) => t.id === c.id))
                      .slice(0, 12)
                      .map((circle) => (
                        <Button
                          key={circle.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full"
                          disabled={taggedCircles.length >= MAX_BIO_COMMUNITY_TAGS}
                          onClick={() => {
                            setTaggedCircles((prev) => {
                              if (prev.some((t) => t.id === circle.id) || prev.length >= MAX_BIO_COMMUNITY_TAGS) {
                                return prev
                              }
                              return [...prev, circle]
                            })
                            // Also drop a tappable token into the bio when there's room
                            const token = serializeCircleBioToken(circle)
                            setFormData((prev) => {
                              if (prev.bio.includes(token) || prev.bio.length + token.length + 1 > 500) {
                                return prev
                              }
                              const next = prev.bio.trim() ? `${prev.bio.trim()} ${token}` : token
                              return { ...prev, bio: next.slice(0, 500) }
                            })
                          }}
                        >
                          + {circle.name}
                        </Button>
                      ))
                  )}
                </div>
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
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
                <div>
                  <Label htmlFor="push_notifications">Push notifications</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pushPermission === "unsupported"
                      ? /iphone|ipad|ipod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "")
                        ? "Add Loop to your Home Screen to enable this on iPhone"
                        : "Not supported in this browser"
                      : pushPermission === "denied"
                        ? "Blocked in your browser's site settings"
                        : "Real device alerts, even in the background"}
                  </p>
                </div>
                <Switch
                  id="push_notifications"
                  checked={formData.notifications.push_notifications && pushPermission === "granted"}
                  disabled={pushBusy || pushPermission === "denied" || pushPermission === "unsupported"}
                  onCheckedChange={handleTogglePush}
                />
              </div>
              {(
                [
                  ["email_notifications", "Email notifications"],
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
                    onCheckedChange={(checked) => {
                      const next = { ...formData.notifications, [key]: checked }
                      setFormData((prev) => ({ ...prev, notifications: next }))
                      void quickSave({ notification_settings: next })
                    }}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          <OrganizationSettings />
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4">
          <ReferralsSettings />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecuritySettings />
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
                      onClick={() => {
                        const next = { ...formData.privacy, profile_visibility: value }
                        setFormData((prev) => ({ ...prev, privacy: next }))
                        void quickSave({
                          privacy_settings: {
                            profile_visibility: value,
                            show_email: next.show_email,
                            message_privacy: next.message_privacy || (next.allow_messages ? "everyone" : "nobody"),
                            allow_messages: next.message_privacy ? next.message_privacy !== "nobody" : next.allow_messages,
                            allow_friend_requests: next.allow_friend_requests,
                          },
                        })
                      }}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Who can send you direct messages</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["everyone", "Everyone"],
                      ["followers", "Followers"],
                      ["nobody", "Nobody"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={formData.privacy.message_privacy === value ? "default" : "outline"}
                      onClick={() => {
                        const next = { ...formData.privacy, message_privacy: value, allow_messages: value !== "nobody" }
                        setFormData((prev) => ({ ...prev, privacy: next }))
                        void quickSave({
                          privacy_settings: {
                            profile_visibility: next.profile_visibility,
                            show_email: next.show_email,
                            message_privacy: value,
                            allow_messages: value !== "nobody",
                            allow_friend_requests: next.allow_friend_requests,
                          },
                        })
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  "Followers" allows messages from people who follow you or whom you follow.
                </p>
              </div>
              {(
                [
                  ["show_email", "Show email on profile"],
                  ["allow_friend_requests", "Allow follow requests / connects"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
                  <Label htmlFor={key}>{label}</Label>
                  <Switch
                    id={key}
                    checked={formData.privacy[key]}
                    onCheckedChange={(checked) => {
                      const next = { ...formData.privacy, [key]: checked }
                      setFormData((prev) => ({ ...prev, privacy: next }))
                      void quickSave({
                        privacy_settings: {
                          profile_visibility: next.profile_visibility,
                          show_email: next.show_email,
                          message_privacy: next.message_privacy || (next.allow_messages ? "everyone" : "nobody"),
                          allow_messages: next.message_privacy ? next.message_privacy !== "nobody" : next.allow_messages,
                          allow_friend_requests: next.allow_friend_requests,
                        },
                      })
                    }}
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
