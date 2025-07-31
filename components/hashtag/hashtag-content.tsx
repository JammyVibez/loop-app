"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Hash, TrendingUp } from "lucide-react"
import { LoopCard } from "@/components/loop-card"

interface HashtagContentProps {
  tag: string
}

// Mock hashtag data
const mockHashtagData = {
  timetravel: {
    count: 1234,
    trending: true,
    description: "Explore the possibilities of time travel through creative loops",
    relatedTags: ["philosophy", "scifi", "future", "past"],
    loops: [
      {
        id: "1",
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
          likes: 234,
          branches: 12,
          comments: 45,
          saves: 67,
        },
      },
      {
        id: "2",
        author: {
          id: "2",
          username: "scifiwriter",
          display_name: "Sci-Fi Writer",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_verified: false,
          is_premium: false,
        },
        content: {
          type: "text" as const,
          text: "Time travel paradox: If you go back and prevent your own birth, who went back in the first place? 🌀 #timetravel #paradox #philosophy",
        },
        created_at: new Date("2024-01-15T09:15:00Z"),
        stats: {
          likes: 189,
          branches: 8,
          comments: 34,
          saves: 45,
        },
      },
    ],
  },
}

export function HashtagContent({ tag }: HashtagContentProps) {
  const [sortBy, setSortBy] = useState("recent")
  const [isFollowing, setIsFollowing] = useState(false)

  // Get hashtag data (in real app, this would be fetched from API)
  const hashtagData = mockHashtagData[tag as keyof typeof mockHashtagData] || {
    count: 0,
    trending: false,
    description: `Explore loops tagged with #${tag}`,
    relatedTags: [],
    loops: [],
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const sortedLoops = [...hashtagData.loops].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return b.created_at.getTime() - a.created_at.getTime()
      case "popular":
        return b.stats.likes - a.stats.likes
      case "branches":
        return b.stats.branches - a.stats.branches
      default:
        return 0
    }
  })

  return (
    <div className="space-y-6">
      {/* Hashtag Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <Hash className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl">#{tag}</CardTitle>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{hashtagData.description}</p>
                <div className="flex items-center space-x-4 mt-2">
                  <span className="text-sm text-gray-500">{formatNumber(hashtagData.count)} loops</span>
                  {hashtagData.trending && (
                    <Badge className="bg-green-100 text-green-700">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Trending
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant={isFollowing ? "outline" : "default"} onClick={() => setIsFollowing(!isFollowing)}>
              {isFollowing ? "Following" : "Follow"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Related Tags */}
      {hashtagData.relatedTags.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Related Tags</h3>
            <div className="flex flex-wrap gap-2">
              {hashtagData.relatedTags.map((relatedTag) => (
                <Badge
                  key={relatedTag}
                  variant="outline"
                  className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  #{relatedTag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Tabs */}
      <Tabs defaultValue="loops" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="loops">Loops</TabsTrigger>
            <TabsTrigger value="top">Top</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1 border rounded-md text-sm bg-background"
            >
              <option value="recent">Most Recent</option>
              <option value="popular">Most Popular</option>
              <option value="branches">Most Branched</option>
            </select>
          </div>
        </div>

        <TabsContent value="loops" className="mt-6">
          {sortedLoops.length > 0 ? (
            <div className="space-y-4">
              {sortedLoops.map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Hash className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">No loops found</h3>
                <p className="text-gray-500 mb-4">Be the first to create a loop with #{tag}</p>
                <Button>Create Loop</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="top" className="mt-6">
          <div className="space-y-4">
            {sortedLoops
              .sort((a, b) => b.stats.likes - a.stats.likes)
              .map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          <div className="space-y-4">
            {sortedLoops
              .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
              .map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
