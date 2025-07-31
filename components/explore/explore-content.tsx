"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, TreePine, Sparkles, TrendingUp, Hash } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { LoopTreeViewer } from "@/components/loop-tree-viewer"

// Mock data for different explore categories
const recentLoops = [
  {
    id: "recent-1",
    author: {
      id: "1",
      username: "newcreator",
      display_name: "New Creator",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: false,
      is_premium: false,
    },
    content: {
      type: "text" as const,
      text: "Just discovered Loop and I'm amazed by the collaborative storytelling possibilities! Starting my first tree about #digitalart and #creativity 🎨",
    },
    created_at: new Date("2024-01-15T16:30:00Z"),
    stats: { likes: 23, branches: 2, comments: 8, saves: 12 },
    branches: [],
  },
  {
    id: "recent-2",
    author: {
      id: "2",
      username: "techwriter",
      display_name: "Tech Writer",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: true,
      verification_level: "influencer" as const,
      is_premium: true,
    },
    content: {
      type: "text" as const,
      text: "The future of AI and human creativity: What happens when machines can branch our thoughts? #ai #future #philosophy",
    },
    created_at: new Date("2024-01-15T16:15:00Z"),
    stats: { likes: 156, branches: 8, comments: 34, saves: 67 },
    branches: [],
  },
]

const deepestTrees = [
  {
    id: "deep-1",
    author: {
      id: "1",
      username: "storyteller",
      display_name: "Story Teller",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: true,
      verification_level: "root" as const,
      is_premium: true,
    },
    content: {
      type: "text" as const,
      text: "Once upon a time, in a world where stories could grow like trees... #storytelling #collaborative",
    },
    created_at: new Date("2024-01-10T10:30:00Z"),
    stats: { likes: 2340, branches: 47, comments: 234, saves: 567 },
    tree_depth: 12,
    total_branches: 47,
    branches: [
      {
        id: "deep-1-branch-1",
        author: {
          id: "2",
          username: "fantasyfan",
          display_name: "Fantasy Fan",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_verified: false,
          is_premium: false,
        },
        content: {
          type: "text" as const,
          text: "The protagonist discovered that each choice created a new branch in reality itself...",
        },
        created_at: new Date("2024-01-10T11:15:00Z"),
        stats: { likes: 456, branches: 12, comments: 67, saves: 123 },
        branches: [],
      },
    ],
  },
]

const mostCreative = [
  {
    id: "creative-1",
    author: {
      id: "1",
      username: "mixedmedia",
      display_name: "Mixed Media Artist",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_verified: true,
      verification_level: "influencer" as const,
      is_premium: true,
    },
    content: {
      type: "image" as const,
      image_url: "/placeholder.svg?height=400&width=600",
      caption:
        "What if colors had emotions? This piece explores synesthesia through digital art. Add your interpretation! #synesthesia #digitalart #emotions",
    },
    created_at: new Date("2024-01-14T14:20:00Z"),
    stats: { likes: 1890, branches: 23, comments: 156, saves: 445 },
    creativity_score: 98.5,
    unique_tags: ["synesthesia", "digitalart", "emotions", "interpretation"],
    branches: [],
  },
]

const trendingHashtags = [
  { tag: "timetravel", count: 15600, growth: "+234%" },
  { tag: "digitalart", count: 12400, growth: "+189%" },
  { tag: "musiccollab", count: 9800, growth: "+156%" },
  { tag: "scifi", count: 8900, growth: "+134%" },
  { tag: "philosophy", count: 7600, growth: "+112%" },
  { tag: "creativity", count: 6800, growth: "+98%" },
  { tag: "storytelling", count: 5900, growth: "+87%" },
  { tag: "collaboration", count: 5200, growth: "+76%" },
]

export function ExploreContent() {
  const [selectedTab, setSelectedTab] = useState("recent")

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  return (
    <div className="space-y-6">
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <TabsTrigger
            value="recent"
            className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Recent</span>
          </TabsTrigger>
          <TabsTrigger
            value="deepest"
            className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
          >
            <TreePine className="w-4 h-4" />
            <span className="hidden sm:inline">Deepest</span>
          </TabsTrigger>
          <TabsTrigger
            value="creative"
            className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Creative</span>
          </TabsTrigger>
          <TabsTrigger
            value="hashtags"
            className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
          >
            <Hash className="w-4 h-4" />
            <span className="hidden sm:inline">Hashtags</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold">Recent Loops</h2>
              <Badge variant="secondary">Newest first</Badge>
            </div>
            {recentLoops.map((loop) => (
              <LoopCard key={loop.id} loop={loop} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deepest" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <TreePine className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-semibold">Deepest Trees</h2>
              <Badge variant="secondary">Most branches</Badge>
            </div>
            {deepestTrees.map((tree) => (
              <div key={tree.id} className="space-y-4">
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <TreePine className="w-5 h-5 text-green-600" />
                        <span className="font-semibold">Tree Depth: {tree.tree_depth} levels</span>
                      </div>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {tree.total_branches} branches
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <LoopCard loop={tree} />
                {tree.branches.length > 0 && <LoopTreeViewer rootLoop={tree} />}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="creative" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-600" />
              <h2 className="text-xl font-semibold">Most Creative</h2>
              <Badge variant="secondary">Highest engagement</Badge>
            </div>
            {mostCreative.map((loop) => (
              <div key={loop.id} className="space-y-4">
                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-5 h-5 text-yellow-600" />
                        <span className="font-semibold">Creativity Score: {loop.creativity_score}%</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {loop.unique_tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <LoopCard loop={loop} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="hashtags" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <Hash className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold">Trending Hashtags</h2>
              <Badge variant="secondary">24h growth</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendingHashtags.map((hashtag, index) => (
                <Card key={hashtag.tag} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                        <Hash className="w-5 h-5 text-purple-600" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {hashtag.growth}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400">#{hashtag.tag}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{formatNumber(hashtag.count)} loops</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
