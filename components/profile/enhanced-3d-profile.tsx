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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-blue-900/20">
      <div className="container mx-auto p-2 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-6xl">
        {/* Enhanced Responsive 3D Profile Header */}
        <Card className="relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 shadow-2xl transform hover:scale-[1.01] transition-all duration-500">
          {/* Banner Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/90 to-blue-600/90">
            {profile.banner_url && (
              <img 
                src={profile.banner_url} 
                alt="Profile banner" 
                className="w-full h-full object-cover opacity-30"
              />
            )}
          </div>

          <CardContent className="relative z-10 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* 3D Avatar */}
              <div className="relative group flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full blur-lg opacity-75 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
                <Avatar className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32 border-4 border-white/50 shadow-2xl transform group-hover:scale-110 transition-transform duration-300">
                  <AvatarImage src={profile.avatar_url} />
                  <AvatarFallback className="text-lg sm:text-2xl lg:text-4xl font-bold bg-gradient-to-r from-purple-500 to-blue-500">
                    {profile.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {profile.is_verified && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                    <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center sm:text-left space-y-2 sm:space-y-3 min-w-0">
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="truncate">{profile.display_name}</span>
                    {profile.is_premium && (
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-0 text-xs">
                        PREMIUM
                      </Badge>
                    )}
                  </h1>
                  <p className="text-base sm:text-xl opacity-90 truncate">@{profile.username}</p>
                </div>

                <p className="text-sm sm:text-lg opacity-80 max-w-2xl line-clamp-3">{profile.bio}</p>

                {/* Profile Meta */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4 text-xs sm:text-sm opacity-80">
                  {profile.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="truncate max-w-24 sm:max-w-none">{profile.location}</span>
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center gap-1">
                      <LinkIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-20 sm:max-w-none">
                        Website
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Joined </span>
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </div>
                </div>

                {/* Coins Display for Own Profile */}
                {isOwnProfile && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 bg-white/20 rounded-full px-3 py-1 w-fit">
                    <Coins className="w-4 h-4 text-yellow-300" />
                    <span className="text-sm font-semibold">{profile.loop_coins.toLocaleString()} Loop Coins</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-start">
                  {isOwnProfile ? (
                    <Button className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full transform hover:scale-105 transition-all duration-200 text-sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleFollow}
                        className={`px-4 sm:px-6 py-2 font-semibold rounded-full transform hover:scale-105 transition-all duration-200 text-sm ${
                          isFollowing 
                            ? "bg-gray-600 hover:bg-gray-700 text-white" 
                            : "bg-white text-purple-600 hover:bg-gray-100"
                        }`}
                      >
                        {isFollowing ? "Unfollow" : "Follow"}
                      </Button>
                      <Button className="px-4 sm:px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full transform hover:scale-105 transition-all duration-200 text-sm">
                        <MessageCircle className="w-4 h-4 mr-2" />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
          {[
            { label: "Followers", value: profile.followers_count, icon: Users, color: "from-blue-500 to-cyan-500" },
            { label: "Following", value: profile.following_count, icon: Heart, color: "from-pink-500 to-rose-500" },
            { label: "Loops", value: profile.loops_count, icon: Flame, color: "from-orange-500 to-red-500" },
            { label: "Branches", value: profile.branches_count, icon: Plus, color: "from-green-500 to-emerald-500" },
            { label: "Level", value: profile.level, icon: Trophy, color: "from-purple-500 to-indigo-500" },
            { label: "Likes", value: profile.likes_received, icon: Star, color: "from-yellow-500 to-orange-500" },
          ].map((stat, index) => (
            <Card key={index} className="relative overflow-hidden group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className={`absolute inset-0 bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
              <CardContent className="p-2 sm:p-4 text-center relative z-10">
                <stat.icon className={`w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-1 sm:mb-2 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} />
                <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">{stat.value.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Enhanced Responsive Content Tabs */}
        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-0 p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 lg:grid-cols-4 h-10 sm:h-12">
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
                      <Card key={loop.id} className="hover:shadow-lg transition-shadow duration-200">
                        <CardContent className="p-3 sm:p-4">
                          <p className="text-sm sm:text-base text-gray-900 dark:text-white line-clamp-3">{loop.content}</p>
                          <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                            <span>{loop.likes_count} likes</span>
                            <span>{loop.comments_count} comments</span>
                            <span className="hidden sm:inline">{new Date(loop.created_at).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <Flame className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">No loops yet</p>
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