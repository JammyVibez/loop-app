"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingUp, Hash, Users, GitBranch } from "lucide-react"
import { LoopCard } from "@/components/loop-card"

// Mock trending data
const trendingHashtags = [
  { tag: "timetravel", count: 15600, growth: "+234%" },
  { tag: "digitalart", count: 12400, growth: "+189%" },
  { tag: "musiccollab", count: 9800, growth: "+156%" },
  { tag: "scifi", count: 8900, growth: "+134%" },
  { tag: "philosophy", count: 7600, growth: "+112%" },
  { tag: "poetry", count: 6800, growth: "+98%" },
  { tag: "coding", count: 5900, growth: "+87%" },
  { tag: "photography", count: 5200, growth: "+76%" },
  { tag: "storytelling", count: 4800, growth: "+65%" },
  { tag: "mindfulness", count: 4200, growth: "+54%" },
]

const trendingLoops = [
  {
    id: "trending-1",
    author: {
      id: "1",
      username: "creativemind",
      display_name: "Creative Mind",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: true,
      verification_level: "root" as const,
      is_premium: true,
    },
    content: {
      type: "text" as const,
      text: "What if we could travel through time but only to witness, never to change anything? 🤔 This thought has been looping in my mind all day... #timetravel #philosophy",
    },
    created_at: new Date("2024-01-15T10:30:00Z"),
    stats: {
      likes: 15600,
      branches: 234,
      comments: 890,
      saves: 1200,
    },
    trending_score: 98.5,
    hashtags: ["timetravel", "philosophy"],
  },
  {
    id: "trending-2",
    author: {
      id: "2",
      username: "musicmaker",
      display_name: "Music Maker",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: true,
      verification_level: "influencer" as const,
      is_premium: true,
    },
    content: {
      type: "audio" as const,
      audio_url: "/placeholder-audio.mp3",
      title: "Midnight Thoughts - Collaborative Beat",
      duration: 120,
    },
    created_at: new Date("2024-01-15T09:20:00Z"),
    stats: {
      likes: 12400,
      branches: 189,
      comments: 567,
      saves: 890,
    },
    trending_score: 94.2,
    hashtags: ["musiccollab", "beats"],
  },
]

const trendingUsers = [
  {
    id: "1",
    username: "creativemind",
    display_name: "Creative Mind",
    avatar_url: "/placeholder.svg?height=60&width=60",
    is_verified: true,
    verification_level: "root" as const,
    is_premium: true,
    followers: 125000,
    loops_count: 234,
    trending_reason: "Viral time travel loop tree",
  },
  {
    id: "2",
    username: "storyteller",
    display_name: "Story Teller",
    avatar_url: "/placeholder.svg?height=60&width=60",
    is_verified: true,
    verification_level: "influencer" as const,
    is_premium: false,
    followers: 89000,
    loops_count: 456,
    trending_reason: "Amazing collaborative stories",
  },
  {
    id: "3",
    username: "digitalartist",
    display_name: "Digital Artist",
    avatar_url: "/placeholder.svg?height=60&width=60",
    is_verified: false,
    is_premium: true,
    followers: 67000,
    loops_count: 189,
    trending_reason: "Stunning visual loop trees",
  },
]

export function TrendingContent() {
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h")

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const getVerificationBadge = (user: any) => {
    if (!user.is_verified) return null
    return (
      <Badge
        variant="secondary"
        className={`${
          user.verification_level === "root"
            ? "bg-green-100 text-green-700 border-green-200"
            : "bg-blue-100 text-blue-700 border-blue-200"
        }`}
      >
        {user.verification_level === "root" ? "🌱 Root" : "⭐ Verified"}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Selector */}
      <div className="flex justify-center">
        <Tabs value={selectedTimeframe} onValueChange={setSelectedTimeframe} className="w-auto">
          <TabsList>
            <TabsTrigger value="1h">Last Hour</TabsTrigger>
            <TabsTrigger value="24h">24 Hours</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs defaultValue="hashtags" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hashtags" className="flex items-center space-x-2">
            <Hash className="w-4 h-4" />
            <span>Hashtags</span>
          </TabsTrigger>
          <TabsTrigger value="loops" className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4" />
            <span>Loops</span>
          </TabsTrigger>
          <TabsTrigger value="creators" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Creators</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hashtags" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingHashtags.map((hashtag, index) => (
              <Card key={hashtag.tag} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      <Hash className="w-5 h-5 text-purple-600" />
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {hashtag.growth}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-bold text-purple-600">#{hashtag.tag}</h3>
                  <p className="text-sm text-gray-600">{formatNumber(hashtag.count)} loops</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="loops" className="mt-6">
          <div className="space-y-6">
            {trendingLoops.map((loop, index) => (
              <div key={loop.id} className="relative">
                <div className="absolute -left-4 top-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                  #{index + 1}
                </div>
                <div className="ml-8">
                  <LoopCard loop={loop} />
                  <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span>Trending Score: {loop.trending_score}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {loop.hashtags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-purple-600">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="creators" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingUsers.map((user, index) => (
              <Card key={user.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      <img
                        src={user.avatar_url || "/placeholder.svg"}
                        alt={user.display_name}
                        className="w-12 h-12 rounded-full"
                      />
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Trending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold">{user.display_name}</h3>
                      {getVerificationBadge(user)}
                      {user.is_premium && (
                        <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">Premium</Badge>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm">@{user.username}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="font-bold text-lg">{formatNumber(user.followers)}</div>
                      <div className="text-sm text-gray-600">Followers</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{user.loops_count}</div>
                      <div className="text-sm text-gray-600">Loops</div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-sm text-purple-700 font-medium">🔥 {user.trending_reason}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
