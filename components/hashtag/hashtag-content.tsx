"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Hash, TrendingUp } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { createClient } from "@/lib/supabase"

interface HashtagContentProps {
  tag: string
}

export function HashtagContent({ tag }: HashtagContentProps) {
  const [sortBy, setSortBy] = useState("recent")
  const [isFollowing, setIsFollowing] = useState(false)
  const [hashtagData, setHashtagData] = useState({
    count: 0,
    trending: false,
    description: `Explore loops tagged with #${tag}`,
    relatedTags: [],
    loops: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHashtagData = async () => {
      try {
        const supabase = createClient()

        // Get hashtag info and loop count
        const { data: hashtagInfo, error: hashtagError } = await supabase
          .from("hashtags")
          .select("*")
          .eq("tag", tag)
          .single()

        // Get loops with this hashtag
        const { data: loops, error: loopsError } = await supabase
          .from("loops")
          .select(`
            *,
            author:profiles(*),
            loop_hashtags!inner(hashtag_id),
            hashtags!inner(tag),
            stats:loop_stats(*)
          `)
          .eq("hashtags.tag", tag)
          .order("created_at", { ascending: false })

        // Get related hashtags
        const { data: relatedTags, error: relatedError } = await supabase
          .from("hashtags")
          .select("tag")
          .neq("tag", tag)
          .limit(10)

        if (!hashtagError && !loopsError) {
          setHashtagData({
            count: loops?.length || 0,
            trending: hashtagInfo?.is_trending || false,
            description: hashtagInfo?.description || `Explore loops tagged with #${tag}`,
            relatedTags: relatedTags?.map((t) => t.tag) || [],
            loops: loops || [],
          })
        }
      } catch (error) {
        console.error("Error fetching hashtag data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchHashtagData()
  }, [tag])

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const sortedLoops = [...hashtagData.loops].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case "popular":
        return (b.stats?.likes || 0) - (a.stats?.likes || 0)
      case "branches":
        return (b.stats?.branches || 0) - (a.stats?.branches || 0)
      default:
        return 0
    }
  })

  const handleFollowHashtag = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      if (isFollowing) {
        await supabase.from("hashtag_follows").delete().eq("user_id", user.id).eq("hashtag_tag", tag)
      } else {
        await supabase.from("hashtag_follows").insert({
          user_id: user.id,
          hashtag_tag: tag,
          created_at: new Date().toISOString(),
        })
      }

      setIsFollowing(!isFollowing)
    } catch (error) {
      console.error("Error following hashtag:", error)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>
  }

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
            <Button variant={isFollowing ? "outline" : "default"} onClick={handleFollowHashtag}>
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
              .sort((a, b) => (b.stats?.likes || 0) - (a.stats?.likes || 0))
              .map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-6">
          <div className="space-y-4">
            {sortedLoops
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
