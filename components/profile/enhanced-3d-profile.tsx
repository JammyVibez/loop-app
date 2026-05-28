"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, MapPin, Link as LinkIcon, Trophy, Flame, Users, Heart, MessageCircle, Plus, Coins, Star, Edit } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

interface UserProfile {
  id: string
  username: string
  display_name: string
  bio: string
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
  can_message?: boolean
}

interface Achievement {
  id: string
  name: string
  description: string
  badge_url: string
  earned_at: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

interface Enhanced3DProfileProps {
  username: string
}

export function Enhanced3DProfile({ username }: Enhanced3DProfileProps) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("loops")
  const [isFollowing, setIsFollowing] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [username])

  const fetchProfile = async () => {
    try {
      const response = await fetch(`/api/users/profile?username=${username}`)
      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        setIsFollowing(data.profile.is_following || false)
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async () => {
    if (!profile) return

    try {
      const response = await fetch('/api/users/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id,
          action: isFollowing ? 'unfollow' : 'follow'
        })
      })

      if (response.ok) {
        setIsFollowing(!isFollowing)
        setProfile(prev => prev ? {
          ...prev,
          followers_count: isFollowing ? prev.followers_count - 1 : prev.followers_count + 1
        } : null)
      }
    } catch (error) {
      console.error("Error following user:", error)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 lg:p-6 space-y-8">
        <div className="animate-pulse">
          <div className="h-32 sm:h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-6"></div>
          <div className="h-16 sm:h-24 bg-gray-200 dark:bg-gray-700 rounded-full w-16 sm:w-24 mx-auto mb-4"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mx-auto mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-4 lg:p-6 text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">User not found</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">The profile you're looking for doesn't exist.</p>
      </div>
    )
  }

  const isOwnProfile = user?.username === profile.username
  const safeDisplayName = profile.display_name || profile.username || "User"
  const safeStats = {
    followers: Number(profile.followers_count ?? 0),
    following: Number(profile.following_count ?? 0),
    loops: Number(profile.loops_count ?? 0),
    branches: Number(profile.branches_count ?? 0),
    level: Number(profile.level ?? 0),
    likes: Number(profile.likes_received ?? 0),
  }
  const safeLoopCoins = Number(profile.loop_coins ?? 0)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.18),transparent_40%),linear-gradient(180deg,#020617_0%,#030712_55%,#020617_100%)]">
      <div className="container mx-auto max-w-6xl space-y-4 p-2 sm:space-y-5 sm:p-4 lg:space-y-6 lg:p-6">
        {/* Enhanced Responsive 3D Profile Header */}
        <Card className="relative overflow-hidden border-white/10 bg-black/35 text-white shadow-[0_30px_80px_-24px_rgba(15,23,42,0.8)] backdrop-blur-xl transition-all duration-500 hover:shadow-[0_36px_90px_-22px_rgba(59,130,246,0.35)]">
          {/* Banner Background */}
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(2,6,23,0.92),rgba(30,41,59,0.78),rgba(15,23,42,0.92))]">
            {profile.banner_url && (
              <img 
                src={profile.banner_url} 
                alt="Profile banner" 
                className="h-full w-full object-cover opacity-35"
              />
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.2),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(168,85,247,0.22),transparent_42%)]" />

          <CardContent className="relative z-10 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
              {/* 3D Avatar */}
              <div className="relative group flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/55 via-blue-500/50 to-violet-500/65 blur-xl opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
                <Avatar className="relative h-20 w-20 border-4 border-white/40 shadow-2xl transition-transform duration-300 group-hover:scale-105 sm:h-24 sm:w-24 lg:h-32 lg:w-32">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900 text-lg font-bold tracking-tight text-white sm:text-2xl lg:text-4xl">
                    {safeDisplayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {profile.is_verified && (
                  <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500 shadow-lg shadow-cyan-500/45 sm:h-8 sm:w-8">
                    <Trophy className="h-3 w-3 text-white sm:h-4 sm:w-4" />
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="min-w-0 flex-1 space-y-2 text-center sm:space-y-3 sm:text-left">
                <div>
                  <h1 className="flex flex-wrap items-center justify-center gap-2 text-xl font-bold tracking-tight sm:justify-start sm:text-2xl lg:text-4xl">
                    <span className="truncate">{safeDisplayName}</span>
                    {profile.is_premium && (
                      <Badge className="border-0 bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-xs font-semibold text-slate-900">
                        PRO
                      </Badge>
                    )}
                  </h1>
                  <p className="truncate text-base text-slate-300 sm:text-xl">@{profile.username}</p>
                </div>

                <p className="line-clamp-3 max-w-2xl text-sm text-slate-200/90 sm:text-lg">
                  {profile.bio || "Building thoughtful communities with depth, style, and signal."}
                </p>

                {/* Profile Meta */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300 sm:justify-start sm:gap-4 sm:text-sm">
                  {profile.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-cyan-300 sm:h-4 sm:w-4" />
                      <span className="max-w-24 truncate sm:max-w-none">{profile.location}</span>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center gap-1">
                      <LinkIcon className="h-3 w-3 text-violet-300 sm:h-4 sm:w-4" />
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="max-w-20 truncate text-cyan-200 hover:underline sm:max-w-none">
                        Website
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-300 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Joined </span>
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>

                {/* Coins Display for Own Profile */}
                {isOwnProfile && (
                  <div className="flex w-fit items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 shadow-inner shadow-white/5 sm:justify-start">
                    <Coins className="h-4 w-4 text-yellow-300" />
                    <span className="text-sm font-semibold">{safeLoopCoins.toLocaleString()} Loop Coins</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start sm:gap-3">
                  {isOwnProfile ? (
                    <Button className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm text-white transition-all duration-200 hover:bg-white/20">
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleFollow}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 sm:px-6 ${
                          isFollowing 
                            ? "border border-white/20 bg-white/10 text-white hover:bg-white/20" 
                            : "bg-white text-slate-900 shadow-lg shadow-cyan-300/20 hover:bg-slate-100"
                        }`}
                      >
                        {isFollowing ? "Unfollow" : "Follow"}
                      </Button>
                      <Button className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-sm text-white transition-all duration-200 hover:bg-white/10 sm:px-6">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Message
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Responsive Stats Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {[
            { label: "Followers", value: safeStats.followers, icon: Users, color: "from-blue-500 to-cyan-500" },
            { label: "Following", value: safeStats.following, icon: Heart, color: "from-pink-500 to-rose-500" },
            { label: "Loops", value: safeStats.loops, icon: Flame, color: "from-orange-500 to-red-500" },
            { label: "Branches", value: safeStats.branches, icon: Plus, color: "from-green-500 to-emerald-500" },
            { label: "Level", value: safeStats.level, icon: Trophy, color: "from-purple-500 to-indigo-500" },
            { label: "Likes", value: safeStats.likes, icon: Star, color: "from-yellow-500 to-orange-500" },
          ].map((stat, index) => (
            <Card key={index} className="group relative overflow-hidden border-white/10 bg-slate-950/65 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-900/20">
              <div className={`absolute inset-0 bg-gradient-to-r ${stat.color} opacity-0 transition-opacity duration-300 group-hover:opacity-10`} />
              <CardContent className="relative z-10 p-2 text-center sm:p-4">
                <stat.icon className={`mx-auto mb-1 h-4 w-4 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent sm:mb-2 sm:h-6 sm:w-6`} />
                <div className="text-lg font-bold tracking-tight text-white sm:text-2xl">{stat.value.toLocaleString()}</div>
                <div className="text-xs text-slate-400 sm:text-sm">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enhanced Responsive Content Tabs */}
        <Card className="border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40">
          <CardHeader className="p-4 pb-0 sm:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid h-10 w-full grid-cols-3 border border-white/10 bg-slate-900/90 sm:h-12 lg:grid-cols-4">
                <TabsTrigger value="loops" className="text-xs sm:text-sm font-medium">Loops</TabsTrigger>
                <TabsTrigger value="branches" className="text-xs sm:text-sm font-medium">Branches</TabsTrigger>
                <TabsTrigger value="achievements" className="text-xs sm:text-sm font-medium">Awards</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs sm:text-sm font-medium hidden lg:block">Activity</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            <Tabs value={activeTab}>
              <TabsContent value="loops" className="space-y-4">
                {profile.recent_loops?.length > 0 ? (
                  <div className="grid gap-4">
                    {profile.recent_loops.map((loop) => (
                      <Card key={loop.id} className="border-white/10 bg-slate-900/60 transition-shadow duration-200 hover:shadow-lg hover:shadow-cyan-900/20">
                        <CardContent className="p-3 sm:p-4">
                          <p className="line-clamp-3 text-sm text-slate-100 sm:text-base">{loop.content}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 sm:gap-4 sm:text-sm">
                            <span>{loop.likes_count} likes</span>
                            <span>{loop.comments_count} comments</span>
                            <span className="hidden sm:inline">{new Date(loop.created_at).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center sm:py-12">
                    <Flame className="mx-auto mb-4 h-8 w-8 text-slate-500 sm:h-12 sm:w-12" />
                    <p className="text-sm text-slate-400 sm:text-base">No loops yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="achievements" className="space-y-4">
                {profile.achievements?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {profile.achievements.map((achievement) => (
                      <Card key={achievement.id} className={`border-2 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
                        achievement.rarity === 'legendary' ? 'border-yellow-500 bg-gradient-to-r from-yellow-50 to-orange-50' :
                        achievement.rarity === 'epic' ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-indigo-50' :
                        achievement.rarity === 'rare' ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50' :
                        'border-gray-300 bg-gray-50'
                      }`}>
                        <CardContent className="p-3 sm:p-4 text-center">
                          <img src={achievement.badge_url} alt={achievement.name} className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3" />
                          <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white mb-1">{achievement.name}</h3>
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{achievement.description}</p>
                          <Badge className={`text-xs ${
                            achievement.rarity === 'legendary' ? 'bg-yellow-500' :
                            achievement.rarity === 'epic' ? 'bg-purple-500' :
                            achievement.rarity === 'rare' ? 'bg-blue-500' :
                            'bg-gray-500'
                          } text-white`}>
                            {achievement.rarity.toUpperCase()}
                          </Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <Trophy className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">No achievements yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="branches" className="space-y-4">
                <div className="text-center py-8 sm:py-12">
                  <Plus className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Branches coming soon</p>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="space-y-4">
                <div className="text-center py-8 sm:py-12">
                  <Flame className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Activity feed coming soon</p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}