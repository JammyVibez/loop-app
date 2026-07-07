"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, Coins, Edit, Flame, Heart, Link as LinkIcon, MapPin, MessageCircle, Plus, Share2, Star, Trophy, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoopCard } from "@/components/loop-card"
import { useAuth } from "@/hooks/use-auth"

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

export function Enhanced3DProfile({ username }: { username: string }) {
  const { user, getAuthHeader } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("loops")
  const [isFollowing, setIsFollowing] = useState(false)

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
                followers_count: isFollowing ? Math.max(0, prev.followers_count - 1) : prev.followers_count + 1,
              }
            : null,
        )
      }
    } catch (error) {
      console.error("Error following user:", error)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <Card className="border-white/10 bg-[#0a1020]/85 text-center text-slate-100">
        <CardContent className="p-10">
          <h1 className="text-2xl font-bold">User not found</h1>
          <p className="mt-2 text-slate-400">The profile you are looking for does not exist.</p>
        </CardContent>
      </Card>
    )
  }

  const isOwnProfile = user?.username === profile.username
  const displayName = profile.display_name || profile.username
  const stats = [
    { label: "Followers", value: profile.followers_count ?? 0, icon: Users, color: "from-cyan-400 to-blue-500" },
    { label: "Following", value: profile.following_count ?? 0, icon: Heart, color: "from-pink-400 to-rose-500" },
    { label: "Loops", value: profile.loops_count ?? 0, icon: Flame, color: "from-orange-400 to-red-500" },
    { label: "Branches", value: profile.branches_count ?? 0, icon: Plus, color: "from-emerald-400 to-green-500" },
    { label: "Level", value: profile.level ?? 1, icon: Trophy, color: "from-violet-400 to-indigo-500" },
    { label: "Likes", value: profile.likes_received ?? 0, icon: Star, color: "from-yellow-300 to-orange-500" },
  ]

  return (
    <div className="space-y-5 lg:space-y-6">
      <Card className="landing-card-3d relative overflow-hidden border-white/10 bg-[#0a1020]/85 text-white shadow-[0_30px_80px_-24px_rgba(15,23,42,0.8)] backdrop-blur-xl">
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(2,6,23,0.92),rgba(30,41,59,0.78),rgba(15,23,42,0.92))]">
          {profile.banner_url && (
            <img src={profile.banner_url} alt="Profile banner" className="h-full w-full object-cover opacity-35" />
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.22),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(168,85,247,0.24),transparent_42%)]" />

        <CardContent className="relative z-10 p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-7">
            <div className="group relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/55 via-blue-500/50 to-violet-500/65 blur-xl opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
              <Avatar className="relative h-24 w-24 border-4 border-white/40 shadow-2xl transition-transform duration-300 group-hover:scale-105 sm:h-28 sm:w-28 lg:h-32 lg:w-32">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900 text-3xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {profile.is_verified && (
                <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/45">
                  <Trophy className="h-4 w-4 text-white" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
              <div>
                <h1 className="flex flex-wrap items-center justify-center gap-2 text-3xl font-bold tracking-tight sm:justify-start lg:text-5xl">
                  <span className="truncate">{displayName}</span>
                  {profile.is_premium && (
                    <Badge className="border-0 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-xs font-semibold text-slate-900">PRO</Badge>
                  )}
                </h1>
                <p className="truncate text-lg text-slate-300 sm:text-xl">@{profile.username}</p>
              </div>

              <p className="max-w-2xl text-sm leading-relaxed text-slate-200/90 sm:text-lg">
                {profile.bio || "Building thoughtful communities with depth, style, and signal."}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300 sm:justify-start sm:text-sm">
                {profile.location && (
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    <MapPin className="h-4 w-4 text-cyan-300" /> {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-cyan-200 hover:bg-white/[0.08]">
                    <LinkIcon className="h-4 w-4" /> Website
                  </a>
                )}
                <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                  <Calendar className="h-4 w-4 text-slate-300" /> Joined {new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
                {isOwnProfile && (
                  <span className="flex items-center gap-1 rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-1 text-yellow-100">
                    <Coins className="h-4 w-4 text-yellow-300" /> {Number(profile.loop_coins ?? 0).toLocaleString()} Loop Coins
                  </span>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-2 sm:justify-start sm:gap-3">
                {isOwnProfile ? (
                  <>
                    <Link href="/settings">
                      <Button className="rounded-full border border-white/25 bg-white/10 px-4 text-white hover:bg-white/20">
                        <Edit className="mr-2 h-4 w-4" /> Edit Profile
                      </Button>
                    </Link>
                    <Button
                      className="rounded-full border border-white/25 bg-white/10 px-4 text-white hover:bg-white/20"
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/profile/${profile.username}`)}
                    >
                      <Share2 className="mr-2 h-4 w-4" /> Share
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleFollow}
                      className={isFollowing ? "rounded-full border border-white/20 bg-white/10 px-6 text-white hover:bg-white/20" : "rounded-full bg-white px-6 font-semibold text-slate-900 shadow-lg shadow-cyan-300/20 hover:bg-slate-100"}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </Button>
                    <Button className="rounded-full border border-white/20 bg-transparent px-6 text-white hover:bg-white/10">
                      <MessageCircle className="mr-2 h-4 w-4" /> Message
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="landing-card-3d group relative overflow-hidden border-white/10 bg-white/[0.045] backdrop-blur-xl">
            <div className={`absolute inset-0 bg-gradient-to-r ${stat.color} opacity-0 transition-opacity duration-300 group-hover:opacity-10`} />
            <CardContent className="relative z-10 p-4 text-center">
              <stat.icon className={`mx-auto mb-2 h-5 w-5 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent sm:h-6 sm:w-6`} />
              <div className="text-2xl font-bold tracking-tight text-white">{Number(stat.value).toLocaleString()}</div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-white/10 bg-[#0a1020]/85 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <CardHeader className="p-4 pb-0 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-11 w-full grid-cols-3 rounded-full border border-white/10 bg-white/[0.04] p-1 lg:grid-cols-4">
              <TabsTrigger value="loops" className="rounded-full text-xs sm:text-sm">Loops</TabsTrigger>
              <TabsTrigger value="branches" className="rounded-full text-xs sm:text-sm">Branches</TabsTrigger>
              <TabsTrigger value="achievements" className="rounded-full text-xs sm:text-sm">Awards</TabsTrigger>
              <TabsTrigger value="activity" className="hidden rounded-full text-xs sm:text-sm lg:block">Activity</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <Tabs value={activeTab}>
            <TabsContent value="loops" className="space-y-4">
              {profile.recent_loops?.length > 0 ? (
                <div className="grid gap-4">
                  {profile.recent_loops.map((loop) => (
                    <LoopCard
                      key={loop.id}
                      loop={loop}
                      onDeleted={(loopId) => setProfile((prev) => prev ? { ...prev, recent_loops: prev.recent_loops.filter((item) => item.id !== loopId) } : prev)}
                      onEdited={(updatedLoop) => setProfile((prev) => prev ? { ...prev, recent_loops: prev.recent_loops.map((item) => item.id === updatedLoop.id ? updatedLoop : item) } : prev)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Flame} label="No loops yet" />
              )}
            </TabsContent>

            <TabsContent value="achievements" className="space-y-4">
              {profile.achievements?.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {profile.achievements.map((achievement) => (
                    <Card key={achievement.id} className="landing-card-3d border-white/10 bg-white/[0.04] text-center">
                      <CardContent className="p-4">
                        <img src={achievement.badge_url} alt={achievement.name} className="mx-auto mb-3 h-14 w-14" />
                        <h3 className="font-semibold text-white">{achievement.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-400">{achievement.description}</p>
                        <Badge className="mt-3 bg-white/10 text-white">{achievement.rarity.toUpperCase()}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Trophy} label="No achievements yet" />
              )}
            </TabsContent>

            <TabsContent value="branches">
              <EmptyState icon={Plus} label="Branches coming soon" />
            </TabsContent>

            <TabsContent value="activity">
              <EmptyState icon={Flame} label="Activity feed coming soon" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyState({ icon: Icon, label }: { icon: typeof Flame; label: string }) {
  return (
    <div className="py-12 text-center">
      <Icon className="mx-auto mb-4 h-10 w-10 text-slate-500" />
      <p className="text-sm text-slate-400 sm:text-base">{label}</p>
    </div>
  )
}
