"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  Coins,
  Edit,
  Flame,
  Gift,
  Heart,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Share2,
  Trophy,
  Upload,
  Users,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoopCard } from "@/components/loop-card"
import { useAuth } from "@/hooks/use-auth"
import { ProfileShareCard } from "@/components/profile/profile-share-card"
import { ProfileSkeleton } from "@/components/loading-states"
import { EmptyState as PageEmptyState } from "@/components/ui/empty-state"
import { ReportContentButton } from "@/components/moderation/report-content-button"
import { GiftModal } from "@/components/gifting/gift-modal"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Achievement {
  id: string
  name: string
  description: string
  badge_url: string
  earned_at: string
  rarity: "common" | "rare" | "epic" | "legendary"
}

interface UserProfile {
  id: string
  username: string
  display_name: string
  bio?: string
  avatar_url?: string
  banner_url?: string
  followers_count: number
  following_count: number
  loops_count: number
  branches_count: number
  likes_received: number
  level: number
  xp_points: number
  loop_coins: number
  is_verified: boolean
  is_premium: boolean
  created_at: string
  website?: string
  location?: string
  achievements: Achievement[]
  recent_loops: any[]
  is_following?: boolean
}

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return String(value)
}

export function Enhanced3DProfile({ username }: { username: string }) {
  const { user, getAuthHeader, refreshUser, applyServerProfile } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("loops")
  const [isFollowing, setIsFollowing] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/users/profile?username=${username}`, {
          headers: user ? getAuthHeader() : undefined,
        })
        if (response.ok) {
          const data = await response.json()
          setProfile(data.profile)
          setIsFollowing(Boolean(data.profile?.is_following))
        }
      } catch (error) {
        console.error("Error fetching profile:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [username, user?.id])

  const handleFollow = async () => {
    if (!profile || !user) return
    try {
      const response = await fetch("/api/users/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          target_user_id: profile.id,
          action: isFollowing ? "unfollow" : "follow",
        }),
      })
      if (response.ok) {
        setIsFollowing(!isFollowing)
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                followers_count: isFollowing
                  ? Math.max(0, prev.followers_count - 1)
                  : prev.followers_count + 1,
              }
            : null,
        )
      }
    } catch (error) {
      console.error("Error following user:", error)
    }
  }

  const handleMessage = async () => {
    if (!user || !profile) {
      window.location.href = "/login"
      return
    }
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ participant_ids: [profile.id] }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not start chat")
      window.location.href = `/messages?c=${data.conversation.id}`
    } catch {
      window.location.href = "/messages"
    }
  }

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return
    setUploadingCover(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "image")
      formData.append("folder", "banners")
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      })
      const uploadData = await uploadRes.json()
      const url = uploadData.url || uploadData.data?.url
      if (!uploadRes.ok || !url) throw new Error(uploadData.error || "Upload failed")

      const saveRes = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ banner_url: url }),
      })
      if (!saveRes.ok) throw new Error("Failed to save cover")
      setProfile((prev) => (prev ? { ...prev, banner_url: url } : prev))
      applyServerProfile({ banner_url: url })
      toast({ title: "Cover updated" })
    } catch (error: any) {
      toast({ title: "Cover upload failed", description: error.message, variant: "destructive" })
    } finally {
      setUploadingCover(false)
      event.target.value = ""
    }
  }

  if (loading) return <ProfileSkeleton />
  if (!profile) {
    return (
      <PageEmptyState
        title="Profile not found"
        description="This user doesn't exist or their profile is private."
        actionLabel="Go home"
        actionHref="/"
      />
    )
  }

  const isOwnProfile = Boolean(user && (user.id === profile.id || user.username === profile.username))
  const displayName = profile.display_name || profile.username

  return (
    <div className="mx-auto w-full max-w-2xl border-x border-border/70 bg-background min-h-screen">
      {/* Sticky top bar like X */}
      <div className="sticky top-0 z-30 flex items-center gap-4 border-b border-border/70 bg-background/85 px-3 py-2 backdrop-blur-xl">
        <Link href="/" className="rounded-full p-2 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-lg font-bold leading-tight">{displayName}</h1>
            {profile.is_verified && (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] text-white">✓</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{formatCount(profile.loops_count)} loops</p>
        </div>
      </div>

      {/* Banner */}
      <div className="relative h-36 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-800 sm:h-48">
        {profile.banner_url ? (
          <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_30%,rgba(56,189,248,0.35),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(139,92,246,0.35),transparent_40%)]" />
        )}
        {isOwnProfile && (
          <>
            <input id="profile-cover-upload" type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            <Button
              size="sm"
              variant="secondary"
              className="absolute bottom-3 right-3 rounded-full bg-black/55 text-white hover:bg-black/70"
              disabled={uploadingCover}
              onClick={() => document.getElementById("profile-cover-upload")?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {uploadingCover ? "Uploading…" : "Edit cover"}
            </Button>
          </>
        )}
      </div>

      {/* Avatar + actions row */}
      <div className="relative px-4 pb-3">
        <div className="-mt-12 flex items-end justify-between sm:-mt-14">
          <Avatar className="h-24 w-24 border-4 border-background bg-muted sm:h-28 sm:w-28">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback className="text-3xl font-bold">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>

          <div className="mb-1 flex flex-wrap justify-end gap-2">
            {isOwnProfile ? (
              <>
                <Link href="/settings">
                  <Button variant="outline" className="rounded-full px-4 font-semibold">
                    <Edit className="mr-2 h-4 w-4" /> Edit profile
                  </Button>
                </Link>
                <ProfileShareCard
                  username={profile.username}
                  displayName={displayName}
                  bio={profile.bio}
                  avatarUrl={profile.avatar_url}
                  triggerClassName="rounded-full border px-3"
                />
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" className="rounded-full" onClick={() => void handleMessage()}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="rounded-full" onClick={() => setShowGiftModal(true)}>
                  <Gift className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => {
                    if (!user) {
                      window.location.href = "/login"
                      return
                    }
                    void handleFollow()
                  }}
                  className={cn(
                    "rounded-full px-5 font-semibold",
                    isFollowing
                      ? "border border-border bg-transparent text-foreground hover:bg-muted"
                      : "bg-foreground text-background hover:opacity-90",
                  )}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-xl font-extrabold tracking-tight">{displayName}</h2>
              {profile.is_verified && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px] text-white">✓</span>
              )}
              {profile.is_premium && (
                <Badge className="rounded-full border-0 bg-amber-400/20 text-amber-300">PRO</Badge>
              )}
            </div>
            <p className="text-muted-foreground">@{profile.username}</p>
          </div>

          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
            {profile.bio || "Building thoughtful communities with depth, style, and signal."}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {profile.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {profile.location}
              </span>
            )}
            {profile.website && (
              <a
                href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-500 hover:underline"
              >
                <LinkIcon className="h-4 w-4" /> {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Joined{" "}
              {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            {isOwnProfile && (
              <span className="inline-flex items-center gap-1 text-amber-500">
                <Coins className="h-4 w-4" /> {Number(profile.loop_coins ?? 0).toLocaleString()} coins
              </span>
            )}
          </div>

          {/* Compact X-style stats */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href={`/profile/${profile.username}/following`} className="hover:underline">
              <span className="font-bold text-foreground">{formatCount(profile.following_count)}</span>{" "}
              <span className="text-muted-foreground">Following</span>
            </Link>
            <Link href={`/profile/${profile.username}/followers`} className="hover:underline">
              <span className="font-bold text-foreground">{formatCount(profile.followers_count)}</span>{" "}
              <span className="text-muted-foreground">Followers</span>
            </Link>
            <span>
              <span className="font-bold text-foreground">{formatCount(profile.loops_count)}</span>{" "}
              <span className="text-muted-foreground">Loops</span>
            </span>
            <span>
              <span className="font-bold text-foreground">{formatCount(profile.branches_count)}</span>{" "}
              <span className="text-muted-foreground">Branches</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              Level {profile.level ?? 1}
            </span>
            <span className="text-muted-foreground">
              <span className="font-bold text-foreground">{formatCount(profile.likes_received)}</span> Likes
            </span>
          </div>

          {!isOwnProfile && (
            <div className="pt-1">
              <ReportContentButton
                contentType="profile"
                contentId={profile.id}
                variant="button"
                label="Report"
                className="h-8 rounded-full px-3 text-xs text-muted-foreground"
              />
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex h-auto w-full justify-stretch rounded-none border-b border-border/70 bg-transparent p-0">
          {[
            { id: "loops", label: "Loops" },
            { id: "branches", label: "Branches" },
            { id: "media", label: "Media" },
            { id: "awards", label: "Awards" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex-1 rounded-none border-b-2 border-transparent py-3 text-sm font-semibold text-muted-foreground data-[state=active]:border-sky-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="loops" className="mt-0 space-y-0">
          {profile.recent_loops?.length > 0 ? (
            profile.recent_loops.map((loop) => (
              <div key={loop.id} className="border-b border-border/60 px-0 py-0">
                <LoopCard loop={loop} className="rounded-none border-0 shadow-none" />
              </div>
            ))
          ) : (
            <EmptyBlock icon={Flame} label="No loops yet" />
          )}
        </TabsContent>

        <TabsContent value="branches" className="mt-0">
          <EmptyBlock icon={Share2} label="Branches will show here" />
        </TabsContent>

        <TabsContent value="media" className="mt-0">
          {profile.recent_loops?.some((l) => l.media_url || l.media_urls?.length) ? (
            <div className="grid grid-cols-3 gap-0.5">
              {profile.recent_loops
                .filter((l) => l.media_url || l.media_urls?.length)
                .map((loop) => {
                  const url = loop.media_url || loop.media_urls?.[0]
                  return (
                    <Link key={loop.id} href={`/loop/${loop.id}`} className="aspect-square bg-muted">
                      {loop.media_type === "video" ? (
                        <video src={url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      )}
                    </Link>
                  )
                })}
            </div>
          ) : (
            <EmptyBlock icon={Users} label="No media yet" />
          )}
        </TabsContent>

        <TabsContent value="awards" className="mt-0 p-4">
          {profile.achievements?.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {profile.achievements.map((achievement) => (
                <Card key={achievement.id} className="border-border/70">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-amber-500" />
                      <p className="font-semibold">{achievement.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{achievement.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyBlock icon={Trophy} label="No awards yet" />
          )}
        </TabsContent>
      </Tabs>

      {!isOwnProfile && (
        <GiftModal
          open={showGiftModal}
          onOpenChange={setShowGiftModal}
          recipient={{
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }}
          context={{ type: "profile", id: profile.id, title: profile.display_name }}
        />
      )}
    </div>
  )
}

function EmptyBlock({ icon: Icon, label }: { icon: typeof Flame; label: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
